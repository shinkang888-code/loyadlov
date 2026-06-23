-- 회원(고객) 관리 CRM — 회원 디렉터리 + 통신 스레드(이메일/카카오)

-- ============================================================
-- 1) 회원(고객) 디렉터리
-- ============================================================
CREATE TABLE IF NOT EXISTS public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  kakao_user_key text,                  -- 카카오 상담과 연동(있으면 카톡 스레드 매칭)
  role text NOT NULL DEFAULT 'member'    -- 권한/등급: member/vip/staff/blocked 등
    CHECK (role IN ('member', 'vip', 'staff', 'manager', 'blocked')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'lead')),
  memo text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_contact_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_store
  ON public.members (store_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_email
  ON public.members (store_code, lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_store" ON public.members;
CREATE POLICY "members_store" ON public.members
  FOR ALL TO authenticated
  USING (store_code = public.current_store_code())
  WITH CHECK (store_code = public.current_store_code());

DROP POLICY IF EXISTS "members_admin" ON public.members;
CREATE POLICY "members_admin" ON public.members
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2) 회원 통신 스레드 (이메일/카카오 송수신 기록)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.member_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  store_code text NOT NULL,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'kakao', 'sms', 'note')),
  direction text NOT NULL DEFAULT 'out' CHECK (direction IN ('in', 'out')),
  subject text,
  content text,
  status text NOT NULL DEFAULT 'sent',   -- sent/received/failed/queued
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_messages_member
  ON public.member_messages (member_id, created_at ASC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_messages TO authenticated;
GRANT ALL ON public.member_messages TO service_role;
ALTER TABLE public.member_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_messages_store" ON public.member_messages;
CREATE POLICY "member_messages_store" ON public.member_messages
  FOR ALL TO authenticated
  USING (store_code = public.current_store_code())
  WITH CHECK (store_code = public.current_store_code());

DROP POLICY IF EXISTS "member_messages_admin" ON public.member_messages;
CREATE POLICY "member_messages_admin" ON public.member_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 3) 실시간 publication
-- ============================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.member_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
