-- 소셜 멀티플랫폼 발행 (Instagram, Threads, YouTube, 네이버 블로그)

CREATE TABLE IF NOT EXISTS public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('instagram', 'threads', 'youtube', 'naver_blog')),
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

CREATE INDEX IF NOT EXISTS idx_social_accounts_store
  ON public.social_accounts (store_code, platform);

CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('instagram', 'threads', 'youtube', 'naver_blog')),
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

CREATE INDEX IF NOT EXISTS idx_social_posts_store_status
  ON public.social_posts (store_code, status, created_at DESC);

-- app_settings (OAuth 관리자 설정)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated, service_role;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_accounts_store" ON public.social_accounts
  FOR ALL TO authenticated
  USING (store_code = public.current_store_code())
  WITH CHECK (store_code = public.current_store_code());

CREATE POLICY "social_posts_store" ON public.social_posts
  FOR ALL TO authenticated
  USING (store_code = public.current_store_code())
  WITH CHECK (store_code = public.current_store_code());

CREATE POLICY "app_settings_admin_read" ON public.app_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "app_settings_admin_write" ON public.app_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER social_accounts_updated_at
  BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER social_posts_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
