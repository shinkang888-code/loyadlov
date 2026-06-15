
-- ENUMs
CREATE TYPE public.draft_status AS ENUM ('draft','review','approved','published','archived');
CREATE TYPE public.schedule_status AS ENUM ('queued','publishing','published','failed','cancelled');
CREATE TYPE public.session_status AS ENUM ('active','expiring','expired','revoked');
CREATE TYPE public.sns_channel AS ENUM ('instagram','tiktok','naver','kakao');

-- Helper: current user's store_code
CREATE OR REPLACE FUNCTION public.current_store_code()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_code FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.current_store_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_store_code() TO authenticated;

-- content_drafts
CREATE TABLE public.content_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_code text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text,
  body text NOT NULL DEFAULT '',
  hashtags text[] NOT NULL DEFAULT '{}',
  image_urls text[] NOT NULL DEFAULT '{}',
  channel public.sns_channel,
  status public.draft_status NOT NULL DEFAULT 'draft',
  ai_model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT body_len CHECK (char_length(body) <= 8000),
  CONSTRAINT title_len CHECK (title IS NULL OR char_length(title) <= 200)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_drafts TO authenticated;
GRANT ALL ON public.content_drafts TO service_role;
ALTER TABLE public.content_drafts ENABLE ROW LEVEL SECURITY;
CREATE INDEX content_drafts_store_idx ON public.content_drafts (store_code, created_at DESC);
CREATE INDEX content_drafts_status_idx ON public.content_drafts (status, created_at DESC);
CREATE TRIGGER content_drafts_set_updated_at BEFORE UPDATE ON public.content_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY drafts_store_select ON public.content_drafts FOR SELECT TO authenticated
  USING (store_code = public.current_store_code() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY drafts_store_insert ON public.content_drafts FOR INSERT TO authenticated
  WITH CHECK (store_code = public.current_store_code() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY drafts_store_update ON public.content_drafts FOR UPDATE TO authenticated
  USING (store_code = public.current_store_code() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (store_code = public.current_store_code() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY drafts_store_delete ON public.content_drafts FOR DELETE TO authenticated
  USING (store_code = public.current_store_code() OR public.has_role(auth.uid(),'admin'));

-- publish_schedule
CREATE TABLE public.publish_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id uuid NOT NULL REFERENCES public.content_drafts(id) ON DELETE CASCADE,
  store_code text NOT NULL,
  channel public.sns_channel NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status public.schedule_status NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  published_at timestamptz,
  external_post_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_schedule TO authenticated;
GRANT ALL ON public.publish_schedule TO service_role;
ALTER TABLE public.publish_schedule ENABLE ROW LEVEL SECURITY;
CREATE INDEX publish_schedule_store_idx ON public.publish_schedule (store_code, scheduled_at DESC);
CREATE INDEX publish_schedule_status_idx ON public.publish_schedule (status, scheduled_at);
CREATE TRIGGER publish_schedule_set_updated_at BEFORE UPDATE ON public.publish_schedule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY sched_store_select ON public.publish_schedule FOR SELECT TO authenticated
  USING (store_code = public.current_store_code() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY sched_store_insert ON public.publish_schedule FOR INSERT TO authenticated
  WITH CHECK (store_code = public.current_store_code() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY sched_store_update ON public.publish_schedule FOR UPDATE TO authenticated
  USING (store_code = public.current_store_code() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (store_code = public.current_store_code() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY sched_store_delete ON public.publish_schedule FOR DELETE TO authenticated
  USING (store_code = public.current_store_code() OR public.has_role(auth.uid(),'admin'));

-- sns_sessions
CREATE TABLE public.sns_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_code text NOT NULL,
  channel public.sns_channel NOT NULL,
  account_handle text,
  status public.session_status NOT NULL DEFAULT 'active',
  last_verified_at timestamptz,
  expires_at timestamptz,
  proxy_region text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_code, channel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sns_sessions TO authenticated;
GRANT ALL ON public.sns_sessions TO service_role;
ALTER TABLE public.sns_sessions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER sns_sessions_set_updated_at BEFORE UPDATE ON public.sns_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY sess_store_select ON public.sns_sessions FOR SELECT TO authenticated
  USING (store_code = public.current_store_code() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY sess_store_insert ON public.sns_sessions FOR INSERT TO authenticated
  WITH CHECK (store_code = public.current_store_code() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY sess_store_update ON public.sns_sessions FOR UPDATE TO authenticated
  USING (store_code = public.current_store_code() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (store_code = public.current_store_code() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY sess_store_delete ON public.sns_sessions FOR DELETE TO authenticated
  USING (store_code = public.current_store_code() OR public.has_role(auth.uid(),'admin'));

-- activity_audit (append-only)
CREATE TABLE public.activity_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  store_code text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT action_len CHECK (char_length(action) BETWEEN 1 AND 80),
  CONSTRAINT resource_type_len CHECK (char_length(resource_type) BETWEEN 1 AND 80)
);
GRANT SELECT, INSERT ON public.activity_audit TO authenticated;
GRANT ALL ON public.activity_audit TO service_role;
ALTER TABLE public.activity_audit ENABLE ROW LEVEL SECURITY;
CREATE INDEX activity_audit_store_idx ON public.activity_audit (store_code, created_at DESC);
CREATE INDEX activity_audit_actor_idx ON public.activity_audit (actor_id, created_at DESC);

CREATE POLICY audit_select_own ON public.activity_audit FOR SELECT TO authenticated
  USING (
    actor_id = auth.uid()
    OR (store_code IS NOT NULL AND store_code = public.current_store_code())
    OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY audit_insert_self ON public.activity_audit FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
