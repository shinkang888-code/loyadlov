// filepath: src/hooks/useGenerationJobsRealtime.ts
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { GenerationJobPublic } from "@/lib/generation.functions";
import { listGenerationJobsFn } from "@/lib/generation.functions";
import { toast } from "sonner";

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

/** Neon Postgres — Supabase Realtime 대신 5초 폴링 */
export function useGenerationJobsRealtime(
  initialJobs: GenerationJobPublic[] = [],
  options: Options = {},
) {
  const { storeCode, notify = false, onUpdate } = options;
  const listJobs = useServerFn(listGenerationJobsFn);
  const [jobs, setJobs] = useState<GenerationJobPublic[]>(initialJobs);
  const prevStatusRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    if (!storeCode) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await listJobs({ data: { storeCode, limit: 50 } });
        if (cancelled) return;

        setJobs((prev) => {
          const incoming = res.jobs;
          if (notify) {
            for (const job of incoming) {
              const prevStatus = prevStatusRef.current.get(job.id);
              if (prevStatus !== job.status) {
                prevStatusRef.current.set(job.id, job.status);
                if (prevStatus !== undefined) {
                  if (job.status === "completed") {
                    toast.success(`${JOB_TYPE_LABEL[job.jobType] ?? "AI 작업"} 완료`, {
                      description:
                        job.jobType === "bulk_pack"
                          ? "드래프트가 생성되었습니다."
                          : "생성 큐에서 확인하세요.",
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
          }
          return incoming;
        });
      } catch (e) {
        console.error("[useGenerationJobsRealtime] poll failed:", e);
      }
    };

    void poll();
    const id = setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [storeCode, notify, onUpdate, listJobs]);

  const activeCount = jobs.filter((j) => j.status === "pending" || j.status === "processing").length;

  return { jobs, activeCount, setJobs };
}
