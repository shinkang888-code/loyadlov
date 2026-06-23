-- 미디어 생성 스튜디오 — Higgsfield/fal 등 외부 AI 미디어 생성 연동
-- (generation_jobs 에 media_gen 작업 타입 추가 + 생성 결과 자산 보관)

-- 1) generation_jobs.job_type 에 'media_gen' 허용 (기존 타입 유지)
ALTER TABLE public.generation_jobs
  DROP CONSTRAINT IF EXISTS generation_jobs_job_type_check;

ALTER TABLE public.generation_jobs
  ADD CONSTRAINT generation_jobs_job_type_check
  CHECK (job_type IN ('text', 'image', 'bulk_pack', 'blog_draft', 'media_gen'));

-- 2) 미디어 자산 (생성된 이미지/영상/오디오 URL 보관)
CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  provider text NOT NULL DEFAULT 'higgsfield',
  kind text NOT NULL DEFAULT 'image',
  prompt text,
  url text NOT NULL,
  thumb_url text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  job_id uuid REFERENCES public.generation_jobs(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_store
  ON public.media_assets (store_code, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_assets_store" ON public.media_assets
  FOR ALL TO authenticated
  USING (store_code = public.current_store_code())
  WITH CHECK (store_code = public.current_store_code());

CREATE POLICY "media_assets_admin" ON public.media_assets
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
