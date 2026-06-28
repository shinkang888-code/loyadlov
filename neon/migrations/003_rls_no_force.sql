-- Hotfix: Neon serverless HTTP 드라이버는 세션 변수가 요청 간 유지되지 않음.
-- FORCE RLS 해제 — 테넌트 격리는 앱 레이어(tenant-db.server.ts) + resolveRequestedStoreCode 유지.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'content_drafts', 'publish_schedule', 'generation_jobs',
    'social_posts', 'social_accounts', 'activity_audit', 'campaign_briefs',
    'campaign_verifications', 'media_assets', 'kakao_consultations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
