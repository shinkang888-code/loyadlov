-- 네이버 블로그 자동작성 — 캠페인 브리프 + 발행 후 검수
-- (DAF N Blog Assistant / Review Brief Studio 의 순수 로직을 loyadbeta 로 이식하며 추가)

-- 1) generation_jobs.job_type 에 'blog_draft' 허용
ALTER TABLE public.generation_jobs
  DROP CONSTRAINT IF EXISTS generation_jobs_job_type_check;

ALTER TABLE public.generation_jobs
  ADD CONSTRAINT generation_jobs_job_type_check
  CHECK (job_type IN ('text', 'image', 'bulk_pack', 'blog_draft'));

-- 2) 캠페인 브리프 (원고 생성 입력 조건 보관)
CREATE TABLE IF NOT EXISTS public.campaign_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  subject_value text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  keyword_required_count smallint NOT NULL DEFAULT 3,
  body_min_chars_no_spaces integer NOT NULL DEFAULT 1000,
  media_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  additional_requests text NOT NULL DEFAULT '',
  writer_style text NOT NULL DEFAULT '기본 작가',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_briefs_store
  ON public.campaign_briefs (store_code, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_briefs TO authenticated;
GRANT ALL ON public.campaign_briefs TO service_role;
ALTER TABLE public.campaign_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_briefs_store" ON public.campaign_briefs
  FOR ALL TO authenticated
  USING (store_code = public.current_store_code())
  WITH CHECK (store_code = public.current_store_code());

CREATE POLICY "campaign_briefs_admin" ON public.campaign_briefs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) 발행 후 검수 결과
CREATE TABLE IF NOT EXISTS public.campaign_verifications (
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
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_verifications_store
  ON public.campaign_verifications (store_code, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_verifications TO authenticated;
GRANT ALL ON public.campaign_verifications TO service_role;
ALTER TABLE public.campaign_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_verifications_store" ON public.campaign_verifications
  FOR ALL TO authenticated
  USING (store_code = public.current_store_code())
  WITH CHECK (store_code = public.current_store_code());

CREATE POLICY "campaign_verifications_admin" ON public.campaign_verifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
