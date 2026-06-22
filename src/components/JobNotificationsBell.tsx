// filepath: src/components/JobNotificationsBell.tsx
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Bot, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { listGenerationJobsFn, type GenerationJobPublic } from "@/lib/generation.functions";
import { useGenerationJobsRealtime } from "@/hooks/useGenerationJobsRealtime";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Props = {
  storeCode?: string;
};

const STATUS_ICON = {
  pending: Loader2,
  processing: Loader2,
  completed: CheckCircle2,
  failed: AlertCircle,
  cancelled: X,
} as const;

export function JobNotificationsBell({ storeCode }: Props) {
  const listJobs = useServerFn(listGenerationJobsFn);
  const [initialJobs, setInitialJobs] = useState<GenerationJobPublic[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!storeCode) return;
    const res = await listJobs({ data: { storeCode, limit: 20 } });
    setInitialJobs(res.jobs);
  }, [listJobs, storeCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const { jobs, activeCount } = useGenerationJobsRealtime(initialJobs, {
    storeCode,
    notify: true,
  });

  const unread = jobs.filter(
    (j) => j.status === "completed" || j.status === "failed" || j.status === "processing"
  ).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative size-10 grid place-items-center rounded-xl bg-secondary border border-border hover:bg-secondary/70 transition"
          aria-label="AI 작업 알림"
        >
          <Bell className="size-4" />
          {(activeCount > 0 || unread > 0) && (
            <span className="absolute top-2 right-2 size-1.5 rounded-full bg-accent animate-pulse" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">AI 작업 알림</div>
          {activeCount > 0 && (
            <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
              {activeCount} 진행 중
            </span>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto p-2 space-y-1">
          {jobs.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">최근 AI 작업 없음</div>
          ) : (
            jobs.slice(0, 12).map((job) => {
              const Icon = STATUS_ICON[job.status as keyof typeof STATUS_ICON] ?? Bot;
              const spinning = job.status === "pending" || job.status === "processing";
              return (
                <div
                  key={job.id}
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl hover:bg-secondary/80 transition"
                >
                  <Icon className={`size-4 mt-0.5 shrink-0 ${spinning ? "animate-spin text-primary" : job.status === "completed" ? "text-emerald-500" : job.status === "failed" ? "text-accent" : "text-muted-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">
                      {job.jobType === "bulk_pack" ? "대량 패키지" : job.jobType === "image" ? "이미지 생성" : "본문 생성"}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {job.status === "processing" ? `${job.progress}% · 처리 중` : job.status}
                    </div>
                    {job.status === "processing" && (
                      <div className="mt-1.5 h-1 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-brand transition-all duration-500"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
