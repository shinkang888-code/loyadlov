-- Loyard schema for Neon Postgres (Neon Auth + server-side access control)
-- Supabase auth.users / RLS / realtime 제거 — 앱 레이어에서 권한 처리

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Roles
CREATE TYPE public.app_role AS ENUM ('owner', 'staff', 'admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles (id = Neon Auth user id)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  store_code TEXT,
  business_name TEXT,
  industry TEXT,
  instagram_handle TEXT,
  naver_handle TEXT,
  sns_channels JSONB NOT NULL DEFAULT '{}'::jsonb,
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_store_code ON public.profiles(store_code);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Leads
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'converted', 'dropped');

CREATE TABLE public.contact_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  name text NOT NULL,
  phone text NOT NULL,
  store_name text,
  industry text,
  message text,
  status public.lead_status NOT NULL DEFAULT 'new',
  admin_note text,
  source text DEFAULT 'landing',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT name_len CHECK (char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT phone_len CHECK (char_length(phone) BETWEEN 6 AND 30),
  CONSTRAINT message_len CHECK (message IS NULL OR char_length(message) <= 2000)
);

CREATE TRIGGER contact_submissions_set_updated_at
  BEFORE UPDATE ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX contact_submissions_status_idx ON public.contact_submissions (status, created_at DESC);

-- Content enums
CREATE TYPE public.draft_status AS ENUM ('draft','review','approved','published','archived');
CREATE TYPE public.schedule_status AS ENUM ('queued','publishing','published','failed','cancelled');
CREATE TYPE public.session_status AS ENUM ('active','expiring','expired','revoked');
CREATE TYPE public.sns_channel AS ENUM ('instagram','tiktok','naver','kakao');

CREATE TABLE public.content_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_code text NOT NULL,
  created_by uuid,
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

CREATE INDEX content_drafts_store_idx ON public.content_drafts (store_code, created_at DESC);
CREATE INDEX content_drafts_status_idx ON public.content_drafts (status, created_at DESC);
CREATE TRIGGER content_drafts_set_updated_at BEFORE UPDATE ON public.content_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

CREATE INDEX publish_schedule_store_idx ON public.publish_schedule (store_code, scheduled_at DESC);
CREATE INDEX publish_schedule_status_idx ON public.publish_schedule (status, scheduled_at);
CREATE TRIGGER publish_schedule_set_updated_at BEFORE UPDATE ON public.publish_schedule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

CREATE TRIGGER sns_sessions_set_updated_at BEFORE UPDATE ON public.sns_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.activity_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid,
  store_code text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT action_len CHECK (char_length(action) BETWEEN 1 AND 80),
  CONSTRAINT resource_type_len CHECK (char_length(resource_type) BETWEEN 1 AND 80)
);

CREATE INDEX activity_audit_store_idx ON public.activity_audit (store_code, created_at DESC);
CREATE INDEX activity_audit_actor_idx ON public.activity_audit (actor_id, created_at DESC);

-- Social publish
CREATE TABLE public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('instagram', 'threads', 'youtube', 'naver_blog', 'tiktok', 'kakao')),
  platform_user_id text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  access_token_enc text NOT NULL,
  refresh_token_enc text,
  token_expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_code, platform, platform_user_id)
);

CREATE INDEX idx_social_accounts_store ON public.social_accounts (store_code, platform);

CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('instagram', 'threads', 'youtube', 'naver_blog', 'tiktok', 'kakao')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  caption text NOT NULL DEFAULT '',
  media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  platform_options jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at timestamptz,
  published_at timestamptz,
  platform_post_id text,
  error_message text,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_posts_store_status ON public.social_posts (store_code, status, created_at DESC);

CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER social_accounts_updated_at
  BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER social_posts_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'standard' CHECK (plan IN ('standard', 'premium')),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('inactive', 'pending', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_store ON public.subscriptions (store_code);

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Generation jobs queue
CREATE TABLE public.generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  created_by uuid NOT NULL,
  job_type text NOT NULL CHECK (job_type IN ('text', 'image', 'bulk_pack', 'blog_draft', 'media_gen')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  progress smallint NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  priority smallint NOT NULL DEFAULT 0,
  batch_id uuid,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error_message text,
  draft_id uuid REFERENCES public.content_drafts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX idx_generation_jobs_store_status
  ON public.generation_jobs (store_code, status, created_at DESC);

CREATE INDEX idx_generation_jobs_pending
  ON public.generation_jobs (status, priority DESC, created_at ASC)
  WHERE status = 'pending';

CREATE TRIGGER generation_jobs_updated_at
  BEFORE UPDATE ON public.generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
    status = 'processing',
    started_at = COALESCE(started_at, now()),
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

-- Blog campaigns
CREATE TABLE public.campaign_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  subject_value text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  keyword_required_count smallint NOT NULL DEFAULT 3,
  body_min_chars_no_spaces integer NOT NULL DEFAULT 1000,
  media_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  additional_requests text NOT NULL DEFAULT '',
  writer_style text NOT NULL DEFAULT '기본 작가',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_briefs_store ON public.campaign_briefs (store_code, created_at DESC);

CREATE TABLE public.campaign_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  brief_id uuid REFERENCES public.campaign_briefs(id) ON DELETE SET NULL,
  draft_id uuid REFERENCES public.content_drafts(id) ON DELETE SET NULL,
  source_url text,
  passed boolean NOT NULL DEFAULT false,
  body jsonb,
  keywords jsonb,
  media jsonb,
  request_results jsonb,
  report_text text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_verifications_store ON public.campaign_verifications (store_code, created_at DESC);

-- Media assets
CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  provider text NOT NULL DEFAULT 'higgsfield',
  kind text NOT NULL DEFAULT 'image',
  prompt text,
  url text NOT NULL,
  thumb_url text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  job_id uuid REFERENCES public.generation_jobs(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_assets_store ON public.media_assets (store_code, created_at DESC);

-- Kakao consultations
CREATE TABLE public.kakao_channel_settings (
  store_code text PRIMARY KEY,
  channel_public_id text,
  channel_chat_url text,
  chatbot_manage_url text,
  webhook_token text,
  bot_enabled boolean NOT NULL DEFAULT false,
  auto_reply text,
  rest_api_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kakao_consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  kakao_user_key text NOT NULL,
  customer_name text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'active', 'pending', 'closed')),
  channel text NOT NULL DEFAULT 'kakaotalk',
  last_message text,
  last_message_at timestamptz,
  unread_count int NOT NULL DEFAULT 0,
  note text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_code, kakao_user_key)
);

CREATE INDEX idx_kakao_consultations_store
  ON public.kakao_consultations (store_code, last_message_at DESC NULLS LAST);

CREATE TABLE public.kakao_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES public.kakao_consultations(id) ON DELETE CASCADE,
  store_code text NOT NULL,
  direction text NOT NULL DEFAULT 'in' CHECK (direction IN ('in', 'out')),
  content text,
  msg_type text NOT NULL DEFAULT 'text',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kakao_messages_consult
  ON public.kakao_messages (consultation_id, created_at ASC);

-- Members CRM
CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  kakao_user_key text,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'vip', 'staff', 'manager', 'blocked')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'lead')),
  memo text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_contact_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_members_store ON public.members (store_code, created_at DESC);
CREATE INDEX idx_members_email ON public.members (store_code, lower(email));

CREATE TABLE public.member_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  store_code text NOT NULL,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'kakao', 'sms', 'note')),
  direction text NOT NULL DEFAULT 'out' CHECK (direction IN ('in', 'out')),
  subject text,
  content text,
  status text NOT NULL DEFAULT 'sent',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_messages_member ON public.member_messages (member_id, created_at ASC);

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ThreadBot
CREATE TABLE public.threadbot_rules (
  store_code text PRIMARY KEY,
  bot_enabled boolean NOT NULL DEFAULT false,
  dry_run boolean NOT NULL DEFAULT true,
  enable_like boolean NOT NULL DEFAULT true,
  enable_reply boolean NOT NULL DEFAULT true,
  daily_like_limit int NOT NULL DEFAULT 20,
  daily_reply_limit int NOT NULL DEFAULT 10,
  run_interval_minutes int NOT NULL DEFAULT 120,
  active_hours_start text NOT NULL DEFAULT '09:00',
  active_hours_end text NOT NULL DEFAULT '23:00',
  keywords_include jsonb NOT NULL DEFAULT '[]'::jsonb,
  keywords_exclude jsonb NOT NULL DEFAULT '["광고","홍보","이벤트","당첨"]'::jsonb,
  tone text NOT NULL DEFAULT 'friendly'
    CHECK (tone IN ('friendly', 'professional', 'humor')),
  min_post_length int NOT NULL DEFAULT 15,
  ai_model text NOT NULL DEFAULT 'gemini-2.5-flash',
  last_run_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.threadbot_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  platform text NOT NULL DEFAULT 'threads'
    CHECK (platform IN ('threads', 'instagram')),
  action text NOT NULL
    CHECK (action IN ('like', 'reply', 'skip', 'error')),
  target_username text,
  post_id text,
  post_preview text,
  reply_text text,
  ai_reason text,
  status text NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'failed', 'dry_run')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_threadbot_activity_store
  ON public.threadbot_activity_logs (store_code, created_at DESC);

CREATE TABLE public.threadbot_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  platform text NOT NULL
    CHECK (platform IN ('threads', 'instagram')),
  username text,
  external_user_id text,
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'expired', 'disconnected', 'needs_business')),
  expires_at timestamptz,
  connected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_code, platform)
);
