-- 카카오톡 상담채널 대시보드
-- 채널 설정 + 상담 세션(인박스) + 메시지 스레드 + 실시간

-- ============================================================
-- 1) 채널 설정 (매장별)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kakao_channel_settings (
  store_code text PRIMARY KEY,
  channel_public_id text,            -- 카카오톡 채널 Public ID (예: _ZeUTxl)
  channel_chat_url text,             -- 상담 대화창(관리자센터) 새창 URL
  chatbot_manage_url text,           -- 카카오 i 오픈빌더 챗봇 관리 URL
  webhook_token text,                -- 웹훅 인증 토큰 (외부 → 우리 서버)
  bot_enabled boolean NOT NULL DEFAULT false,
  auto_reply text,                   -- 봇 자동응답 기본 메시지
  rest_api_key text,                 -- (선택) 발송용 REST API Key
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kakao_channel_settings TO authenticated;
GRANT ALL ON public.kakao_channel_settings TO service_role;
ALTER TABLE public.kakao_channel_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kakao_settings_store" ON public.kakao_channel_settings;
CREATE POLICY "kakao_settings_store" ON public.kakao_channel_settings
  FOR ALL TO authenticated
  USING (store_code = public.current_store_code())
  WITH CHECK (store_code = public.current_store_code());

DROP POLICY IF EXISTS "kakao_settings_admin" ON public.kakao_channel_settings;
CREATE POLICY "kakao_settings_admin" ON public.kakao_channel_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2) 상담 세션 (인박스)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kakao_consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  kakao_user_key text NOT NULL,                 -- 발신자 식별키 (Kakao app_user_id 등)
  customer_name text,                           -- 표시 이름(수정 가능)
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

CREATE INDEX IF NOT EXISTS idx_kakao_consultations_store
  ON public.kakao_consultations (store_code, last_message_at DESC NULLS LAST);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kakao_consultations TO authenticated;
GRANT ALL ON public.kakao_consultations TO service_role;
ALTER TABLE public.kakao_consultations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kakao_consult_store" ON public.kakao_consultations;
CREATE POLICY "kakao_consult_store" ON public.kakao_consultations
  FOR ALL TO authenticated
  USING (store_code = public.current_store_code())
  WITH CHECK (store_code = public.current_store_code());

DROP POLICY IF EXISTS "kakao_consult_admin" ON public.kakao_consultations;
CREATE POLICY "kakao_consult_admin" ON public.kakao_consultations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 3) 메시지 스레드
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kakao_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES public.kakao_consultations(id) ON DELETE CASCADE,
  store_code text NOT NULL,
  direction text NOT NULL DEFAULT 'in' CHECK (direction IN ('in', 'out')),
  content text,
  msg_type text NOT NULL DEFAULT 'text',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kakao_messages_consult
  ON public.kakao_messages (consultation_id, created_at ASC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kakao_messages TO authenticated;
GRANT ALL ON public.kakao_messages TO service_role;
ALTER TABLE public.kakao_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kakao_messages_store" ON public.kakao_messages;
CREATE POLICY "kakao_messages_store" ON public.kakao_messages
  FOR ALL TO authenticated
  USING (store_code = public.current_store_code())
  WITH CHECK (store_code = public.current_store_code());

DROP POLICY IF EXISTS "kakao_messages_admin" ON public.kakao_messages;
CREATE POLICY "kakao_messages_admin" ON public.kakao_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 4) 실시간 publication
-- ============================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.kakao_consultations;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.kakao_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
