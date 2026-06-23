// filepath: src/hooks/useGenerationJobsRealtime.ts
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GenerationJobPublic } from "@/lib/generation.functions";
import { toast } from "sonner";

type JobRow = {
  id: string;
  store_code: string;
  job_type: string;
  status: string;
  progress: number;
  batch_id: string | null;
  input: unknown;
  result: unknown;
  error_message: string | null;
  draft_id: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
};

function mapRow(row: JobRow): GenerationJobPublic {
  return {
    id: row.id,
    storeCode: row.store_code,
    jobType: row.job_type,
    status: row.status,
    progress: row.progress,
    batchId: row.batch_id,
    input: (row.input ?? {}) as Record<string, unknown>,
    result: row.result ? (row.result as Record<string, unknown>) : null,
    errorMessage: row.error_message,
    draftId: row.draft_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

const JOB_TYPE_LABEL: Record<string, string> = {
  text: "본문 생성",
  image: "이미지 생성",
  bulk_pack: "대량 패키지",
};

type Options = {
  storeCode?: string;
  notify?: boolean;
  onUpdate?: (job: GenerationJobPublic) => void;
};

export function useGenerationJobsRealtime(
  initialJobs: GenerationJobPublic[] = [],
  options: Options = {}
) {
  const { storeCode, notify = false, onUpdate } = options;
  const [jobs, setJobs] = useState<GenerationJobPublic[]>(initialJobs);
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  // 인스턴스별 고유 채널 토픽 — 같은 storeCode를 구독하는 다른 컴포넌트/재마운트와
  // 토픽이 겹쳐 "cannot add postgres_changes callbacks after subscribe()" 에러가
  // 나는 것을 방지한다.
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2));

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    if (!storeCode) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`generation_jobs:${storeCode}:${instanceIdRef.current}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "generation_jobs",
            filter: `store_code=eq.${storeCode}`,
          },
        (payload) => {
          const row = (payload.new ?? payload.old) as JobRow | undefined;
          if (!row?.id) return;
          const job = mapRow(row);

          setJobs((prev) => {
            const idx = prev.findIndex((j) => j.id === job.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = job;
              return next;
            }
            return [job, ...prev].slice(0, 50);
          });

          if (notify) {
            const prevStatus = prevStatusRef.current.get(job.id);
            if (prevStatus !== job.status) {
              prevStatusRef.current.set(job.id, job.status);
              if (job.status === "completed") {
                toast.success(`${JOB_TYPE_LABEL[job.jobType] ?? "AI 작업"} 완료`, {
                  description: job.jobType === "bulk_pack" ? "드래프트가 생성되었습니다." : "생성 큐에서 확인하세요.",
                });
              } else if (job.status === "failed") {
                toast.error(`${JOB_TYPE_LABEL[job.jobType] ?? "AI 작업"} 실패`, {
                  description: job.errorMessage ?? "다시 시도해 주세요.",
                });
              }
            }
          }

          onUpdate?.(job);
        }
        )
        .subscribe();
    } catch (e) {
      console.error("[useGenerationJobsRealtime] subscribe failed:", e);
    }

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [storeCode, notify, onUpdate]);

  const activeCount = jobs.filter((j) => j.status === "pending" || j.status === "processing").length;

  return { jobs, activeCount, setJobs };
}
