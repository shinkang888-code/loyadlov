-- store_code 세션 변수 기반 RLS (Neon connection pooler / transaction 세션에서 활성)
-- 앱 레이어: SET LOCAL app.current_store_code / app.current_user_id / app.bypass_rls

CREATE OR REPLACE FUNCTION public.app_current_store_code()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.current_store_code', true), '')
$$;

CREATE OR REPLACE FUNCTION public.app_current_user_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION public.app_bypass_rls()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.bypass_rls', true), 'false') = 'true'
$$;

CREATE OR REPLACE FUNCTION public.app_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = public.app_current_user_id() AND ur.role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.tenant_store_visible(p_store_code text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.app_bypass_rls()
    OR public.app_is_admin()
    OR (p_store_code IS NOT NULL AND p_store_code = public.app_current_store_code())
$$;

-- generation_jobs: claimed 상태 추가
ALTER TABLE public.generation_jobs DROP CONSTRAINT IF EXISTS generation_jobs_status_check;
ALTER TABLE public.generation_jobs ADD CONSTRAINT generation_jobs_status_check
  CHECK (status IN ('pending', 'claimed', 'processing', 'completed', 'failed', 'cancelled'));

ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- social_posts: publishing interlock
ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_status_check;
ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_status_check
  CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed'));

ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_generation_jobs(p_limit int DEFAULT 3)
RETURNS SETOF public.generation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.generation_jobs
  SET
    status = 'claimed',
    claimed_at = COALESCE(claimed_at, now()),
    updated_at = now()
  WHERE id IN (
    SELECT id FROM public.generation_jobs
    WHERE status = 'pending'
    ORDER BY priority DESC, created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_social_post(p_post_id uuid)
RETURNS public.social_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.social_posts;
BEGIN
  UPDATE public.social_posts
  SET status = 'publishing', claimed_at = now(), updated_at = now()
  WHERE id = p_post_id
    AND status IN ('draft', 'scheduled')
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_due_social_posts(p_limit int DEFAULT 20)
RETURNS SETOF public.social_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.social_posts
  SET status = 'publishing', claimed_at = now(), updated_at = now()
  WHERE id IN (
    SELECT id FROM public.social_posts
    WHERE status = 'scheduled' AND scheduled_at <= now()
    ORDER BY scheduled_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- RLS enable (pooler 세션에서 app.* 설정 시 적용)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'content_drafts', 'publish_schedule', 'generation_jobs',
    'social_posts', 'social_accounts', 'activity_audit', 'campaign_briefs',
    'campaign_verifications', 'media_assets', 'kakao_consultations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I FOR ALL USING (public.tenant_store_visible(store_code)) WITH CHECK (public.tenant_store_visible(store_code))',
      t
    );
  END LOOP;
END $$;
