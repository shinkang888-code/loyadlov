// filepath: src/components/QueuePanel.tsx
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listQueueFn, type QueueItem } from "@/lib/profiles.functions";
import { listGenerationJobsFn } from "@/lib/generation.functions";
import { useGenerationJobsRealtime } from "@/hooks/useGenerationJobsRealtime";
import { Loader2, Layers, RefreshCw, Clock, FileText, Send, Bot } from "lucide-react";

type Props = {
  storeCode?: string;
  storeName?: string;
};

const STATUS_LABEL: Record<string, string> = {
  queued: "대기",
  publishing: "발행 중",
  published: "완료",
  failed: "실패",
  draft: "임시저장",
  scheduled: "예약",
  review: "검토",
  approved: "승인",
  pending: "큐 대기",
  processing: "AI 생성 중",
  completed: "완료",
  cancelled: "취소",
};

const KIND_ICON = {
  schedule: Clock,
  social: Send,
  draft: FileText,
  generation: Bot,
} as const;

export function QueuePanel({ storeCode, storeName }: Props) {
  const listQueue = useServerFn(listQueueFn);
  const listGenJobs = useServerFn(listGenerationJobsFn);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storeCode) {
      setItems([]);
      setTotal(0);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [queueRes, genRes] = await Promise.all([
        listQueue({ data: { storeCode } }),
        listGenJobs({ data: { storeCode, limit: 20 } }).catch(() => ({ jobs: [] })),
      ]);
      setItems(Array.isArray(queueRes?.items) ? queueRes.items : []);
      setTotal(queueRes?.total ?? 0);

      // Realtime 훅 시드용 — generation 항목은 Realtime으로 progress 동기화
      const genJobs = Array.isArray(genRes?.jobs) ? genRes.jobs : [];
      setGenSeed(
        genJobs.map((j) => ({
          id: j.id,
          storeCode: j.storeCode,
          jobType: j.jobType,
          status: j.status,
          progress: j.progress,
          batchId: j.batchId,
          input: j.input,
          result: j.result,
          errorMessage: j.errorMessage,
          draftId: j.draftId,
          createdAt: j.createdAt,
          updatedAt: j.updatedAt,
          startedAt: j.startedAt,
          completedAt: j.completedAt,
        }))
      );
    } catch (e) {
      setItems([]);
      setTotal(0);
      setGenSeed([]);
      setLoadError(e instanceof Error ? e.message : "큐를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [listQueue, listGenJobs, storeCode]);

  const [genSeed, setGenSeed] = useState<
    import("@/lib/generation.functions").GenerationJobPublic[]
  >([]);

  const { jobs: liveJobs } = useGenerationJobsRealtime(genSeed, { storeCode });

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime progress → 큐 아이템 병합
  const mergedItems = items.map((item) => {
    if (item.kind !== "generation") return item;
    const live = liveJobs.find((j) => j.id === item.id);
    if (!live) return item;
    return {
      ...item,
      status: live.status,
      progress: live.progress,
      title:
        live.jobType === "bulk_pack"
          ? `AI 대량 생성 · ${live.progress}%`
          : live.jobType === "image"
            ? `AI 이미지 · ${live.progress}%`
            : `AI 본문 · ${live.progress}%`,
    };
  });

  const activeGen = liveJobs.filter((j) => j.status === "pending" || j.status === "processing").length;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-secondary/50 overflow-y-auto">
      <div className="px-6 py-5 border-b border-border bg-card flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Layers className="size-5 text-crimson" /> 생성 · 발행 큐
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {storeName ? `${storeName} · ` : ""}
            예약·드래프트·소셜·AI 작업 {total}건
            {activeGen > 0 && (
              <span className="ml-2 text-accent font-semibold">· {activeGen} AI 작업 Realtime 동기화 중</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border text-xs font-medium hover:bg-secondary transition"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin inline mr-2" />
            큐 로딩 중…
          </div>
        ) : loadError ? (
          <div className="py-16 text-center max-w-md mx-auto space-y-3">
            <p className="text-sm text-destructive font-medium">큐를 불러오지 못했습니다</p>
            <p className="text-xs text-muted-foreground">{loadError}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-border text-xs font-medium hover:bg-secondary transition"
            >
              <RefreshCw className="size-3.5" />
              다시 시도
            </button>
          </div>
        ) : mergedItems.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            대기 중인 작업이 없습니다.
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl">
            {mergedItems.map((item) => {
              const Icon = KIND_ICON[item.kind] ?? Bot;
              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-card border border-border"
                >
                  <div className="size-9 rounded-xl bg-secondary grid place-items-center shrink-0">
                    <Icon className={`size-4 text-foreground/70 ${item.kind === "generation" && (item.status === "pending" || item.status === "processing") ? "animate-pulse text-primary" : ""}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{item.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {item.channel} ·{" "}
                      {item.kind === "schedule"
                        ? "예약"
                        : item.kind === "social"
                          ? "소셜"
                          : item.kind === "generation"
                            ? "AI 큐"
                            : "드래프트"}
                    </div>
                    {item.kind === "generation" && item.progress != null && item.status === "processing" && (
                      <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden max-w-xs">
                        <div
                          className="h-full bg-brand transition-all duration-500"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-semibold">{STATUS_LABEL[item.status] ?? item.status}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {item.scheduledAt
                        ? new Date(item.scheduledAt).toLocaleString("ko-KR", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : new Date(item.createdAt).toLocaleDateString("ko-KR")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
