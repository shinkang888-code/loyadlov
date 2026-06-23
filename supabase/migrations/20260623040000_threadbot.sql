-- 쓰레드봇(ThreadBot) — Threads/Instagram 자동 피드 운영 대시보드
-- 봇 규칙 + 활동 로그 + 연동 계정 + 실시간

-- ============================================================
-- 1) 봇 규칙 (매장별)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.threadbot_rules (
  store_code text PRIMARY KEY,
  bot_enabled boolean NOT NULL DEFAULT false,
  dry_run boolean NOT NULL DEFAULT true,
  enable_like boolean NOT NULL DEFAULT true,
  enable_reply boolean NOT NULL DEFAULT true,
  daily_like_limit int NOT NULL DEFAULT 20,
  daily_reply_limit int NOT NULL DEFAULT 10,
  run_interval_minutes int NOT NULL DEFAULT 120,   -- 실행 주기(분)
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.threadbot_rules TO authenticated;
GRANT ALL ON public.threadbot_rules TO service_role;
ALTER TABLE public.threadbot_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threadbot_rules_store" ON public.threadbot_rules;
CREATE POLICY "threadbot_rules_store" ON public.threadbot_rules
  FOR ALL TO authenticated
  USING (store_code = public.current_store_code())
  WITH CHECK (store_code = public.current_store_code());

DROP POLICY IF EXISTS "threadbot_rules_admin" ON public.threadbot_rules;
CREATE POLICY "threadbot_rules_admin" ON public.threadbot_rules
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2) 활동 로그 (공감/댓글/스킵/에러)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.threadbot_activity_logs (
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

CREATE INDEX IF NOT EXISTS idx_threadbot_activity_store
  ON public.threadbot_activity_logs (store_code, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.threadbot_activity_logs TO authenticated;
GRANT ALL ON public.threadbot_activity_logs TO service_role;
ALTER TABLE public.threadbot_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threadbot_activity_store" ON public.threadbot_activity_logs;
CREATE POLICY "threadbot_activity_store" ON public.threadbot_activity_logs
  FOR ALL TO authenticated
  USING (store_code = public.current_store_code())
  WITH CHECK (store_code = public.current_store_code());

DROP POLICY IF EXISTS "threadbot_activity_admin" ON public.threadbot_activity_logs;
CREATE POLICY "threadbot_activity_admin" ON public.threadbot_activity_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 3) 연동 계정 상태 (Threads / Instagram)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.threadbot_accounts (
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.threadbot_accounts TO authenticated;
GRANT ALL ON public.threadbot_accounts TO service_role;
ALTER TABLE public.threadbot_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threadbot_accounts_store" ON public.threadbot_accounts;
CREATE POLICY "threadbot_accounts_store" ON public.threadbot_accounts
  FOR ALL TO authenticated
  USING (store_code = public.current_store_code())
  WITH CHECK (store_code = public.current_store_code());

DROP POLICY IF EXISTS "threadbot_accounts_admin" ON public.threadbot_accounts;
CREATE POLICY "threadbot_accounts_admin" ON public.threadbot_accounts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 4) 실시간 publication
-- ============================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.threadbot_activity_logs;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
