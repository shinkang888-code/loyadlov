-- 비동기 AI 생성 작업 큐 (Postgres 기반 — Vercel Cron 워커 + Supabase Realtime)
-- NOTE: 20260622000000 은 원격에 platform_settings_owner 로 이미 적용됨 → 새 버전 사용

CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('text', 'image', 'bulk_pack')),
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

CREATE INDEX IF NOT EXISTS idx_generation_jobs_store_status
  ON public.generation_jobs (store_code, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_pending
  ON public.generation_jobs (status, priority DESC, created_at ASC)
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.generation_jobs TO authenticated, service_role;
GRANT ALL ON public.generation_jobs TO service_role;

ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "generation_jobs_store" ON public.generation_jobs
  FOR ALL TO authenticated
  USING (store_code = public.current_store_code())
  WITH CHECK (store_code = public.current_store_code());

CREATE POLICY "generation_jobs_admin" ON public.generation_jobs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

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

REVOKE ALL ON FUNCTION public.claim_generation_jobs(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_generation_jobs(int) TO service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_jobs;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
