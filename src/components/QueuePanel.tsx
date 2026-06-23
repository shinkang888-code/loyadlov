// filepath: src/components/QueuePanel.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listQueueFn, type QueueItem } from "@/lib/profiles.functions";
import {
  listGenerationJobsFn,
  cancelGenerationJobFn,
  retryGenerationJobFn,
  type GenerationJobPublic,
} from "@/lib/generation.functions";
import { useGenerationJobsRealtime } from "@/hooks/useGenerationJobsRealtime";
import {
  Loader2,
  Layers,
  RefreshCw,
  Clock,
  FileText,
  Send,
  Bot,
  Activity,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  RotateCw,
  X,
  Sparkles,
  Image as ImageIcon,
  Package,
} from "lucide-react";

type Props = { storeCode?: string; storeName?: string };

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

const KIND_LABEL = {
  schedule: "예약 발행",
  social: "소셜",
  draft: "드래프트",
  generation: "AI 생성",
} as const;

type StatusGroup = "active" | "waiting" | "scheduled" | "done" | "failed";

function statusGroup(status: string): StatusGroup {
  if (["processing", "publishing"].includes(status)) return "active";
  if (["scheduled"].includes(status)) return "scheduled";
  if (["completed", "published"].includes(status)) return "done";
  if (["failed"].includes(status)) return "failed";
  if (["cancelled"].includes(status)) return "done";
  return "waiting";
}

const STATUS_PILL: Record<string, string> = {
  active: "bg-primary/15 text-primary",
  waiting: "bg-secondary text-muted-foreground",
  scheduled: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  failed: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

function genJobToItem(j: GenerationJobPublic): QueueItem {
  const title =
    j.jobType === "bulk_pack"
      ? "AI 대량 패키지 생성"
      : j.jobType === "image"
        ? "AI 이미지 생성"
        : j.jobType === "media_gen"
          ? "AI 미디어 생성"
          : "AI 본문 생성";
  return {
    id: j.id,
    kind: "generation",
    title,
    channel: "ai",
    status: j.status,
    progress: j.progress,
    scheduledAt: null,
    storeCode: j.storeCode,
    createdAt: j.createdAt,
  };
}

const FILTERS: { id: "all" | StatusGroup; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "active", label: "진행 중" },
  { id: "waiting", label: "대기" },
  { id: "scheduled", label: "예약" },
  { id: "done", label: "완료" },
  { id: "failed", label: "실패" },
];

export function QueuePanel({ storeCode, storeName }: Props) {
  const listQueue = useServerFn(listQueueFn);
  const listGenJobs = useServerFn(listGenerationJobsFn);
  const cancelJob = useServerFn(cancelGenerationJobFn);
  const retryJob = useServerFn(retryGenerationJobFn);

  const [items, setItems] = useState<QueueItem[]>([]);
  const [genSeed, setGenSeed] = useState<GenerationJobPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | StatusGroup>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storeCode) {
      setItems([]);
      setGenSeed([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [queueRes, genRes] = await Promise.all([
        listQueue({ data: { storeCode } }),
        listGenJobs({ data: { storeCode, limit: 30 } }).catch(() => ({ jobs: [] })),
      ]);
      const genJobs = (genRes as { jobs?: GenerationJobPublic[] })?.jobs;
      setItems(Array.isArray(queueRes?.items) ? queueRes.items : []);
      setGenSeed(Array.isArray(genJobs) ? genJobs : []);
    } catch (e) {
      setItems([]);
      setGenSeed([]);
      setLoadError(e instanceof Error ? e.message : "큐를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [listQueue, listGenJobs, storeCode]);

  const { jobs: liveJobs } = useGenerationJobsRealtime(genSeed, { storeCode });

  useEffect(() => {
    void load();
  }, [load]);

  // 큐 아이템(예약/소셜/드래프트/AI) + Realtime AI 진행률 병합 + 완료/취소 AI 작업 포함
  const unified = useMemo<QueueItem[]>(() => {
    const merged = items.map((item) => {
      if (item.kind !== "generation") return item;
      const live = liveJobs.find((j) => j.id === item.id);
      return live ? { ...item, status: live.status, progress: live.progress } : item;
    });
    const extra = liveJobs
      .filter((j) => !items.some((it) => it.id === j.id))
      .map(genJobToItem);
    return [...merged, ...extra];
  }, [items, liveJobs]);

  const counts = useMemo(() => {
    const c = { active: 0, waiting: 0, scheduled: 0, done: 0, failed: 0 };
    for (const it of unified) c[statusGroup(it.status)]++;
    return c;
  }, [unified]);

  const doneToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return liveJobs.filter(
      (j) => j.status === "completed" && j.completedAt && new Date(j.completedAt) >= start
    ).length;
  }, [liveJobs]);

  const visible = useMemo(() => {
    const list =
      filter === "all" ? unified : unified.filter((it) => statusGroup(it.status) === filter);
    return [...list].sort((a, b) => {
      const rank = (s: string) => {
        const g = statusGroup(s);
        return g === "active" ? 0 : g === "waiting" ? 1 : g === "scheduled" ? 2 : g === "failed" ? 3 : 4;
      };
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      const ta = a.scheduledAt ?? a.createdAt;
      const tb = b.scheduledAt ?? b.createdAt;
      return new Date(ta).getTime() - new Date(tb).getTime();
    });
  }, [unified, filter]);

  const processing = unified.filter((it) => statusGroup(it.status) === "active");

  const handleCancel = async (id: string) => {
    setBusyId(id);
    try {
      await cancelJob({ data: { jobId: id } });
      toast.success("작업을 취소했습니다.");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "취소 실패");
    } finally {
      setBusyId(null);
    }
  };

  const handleRetry = async (id: string) => {
    setBusyId(id);
    try {
      await retryJob({ data: { jobId: id } });
      toast.success("재시도를 큐에 넣었습니다.");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "재시도 실패");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-secondary/50 overflow-y-auto">
      {/* 헤더 */}
      <div className="px-6 py-5 border-b border-border bg-card flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Layers className="size-5 text-primary" /> 생성 · 발행 큐
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {storeName ? `${storeName} · ` : ""}
            AI 생성 작업과 예약·소셜·드래프트 발행을 한 곳에서 추적합니다.
            {counts.active > 0 && (
              <span className="ml-2 text-primary font-semibold">
                · {counts.active}건 실시간 처리 중
              </span>
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

      <div className="p-6 space-y-6 max-w-5xl w-full">
        {/* KPI 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<Activity className="size-4 text-primary" />}
            label="진행 중"
            value={counts.active}
            accent="text-primary"
          />
          <KpiCard
            icon={<Clock className="size-4 text-muted-foreground" />}
            label="대기"
            value={counts.waiting + counts.scheduled}
          />
          <KpiCard
            icon={<CheckCircle2 className="size-4 text-emerald-500" />}
            label="오늘 AI 완료"
            value={doneToday}
            accent="text-emerald-600 dark:text-emerald-400"
          />
          <KpiCard
            icon={<AlertTriangle className="size-4 text-rose-500" />}
            label="실패 / 재시도"
            value={counts.failed}
            accent={counts.failed > 0 ? "text-rose-600 dark:text-rose-400" : undefined}
          />
        </div>

        {/* 진행 중 실시간 섹션 */}
        {processing.length > 0 && (
          <section className="rounded-2xl bg-card border border-border p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <Sparkles className="size-4 text-primary animate-pulse" /> 실시간 처리 중
            </h3>
            <div className="space-y-4">
              {processing.map((it) => (
                <div key={`live-${it.id}`}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium flex items-center gap-1.5">
                      <GenIcon title={it.title} /> {it.title}
                    </span>
                    <span className="text-muted-foreground">{it.progress ?? 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full transition-all duration-500"
                      style={{ width: `${it.progress ?? 5}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 필터 탭 */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const n =
              f.id === "all"
                ? unified.length
                : f.id === "waiting"
                  ? counts.waiting
                  : counts[f.id];
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`shrink-0 inline-flex items-center gap-2 h-8 px-3 rounded-full text-xs font-medium transition ${
                  active
                    ? "bg-brand text-primary-foreground shadow-soft"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
                <span
                  className={`text-[10px] px-1.5 rounded-full ${
                    active ? "bg-white/20" : "bg-secondary"
                  }`}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        {/* 리스트 */}
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin inline mr-2" />큐 로딩 중…
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
              <RefreshCw className="size-3.5" />다시 시도
            </button>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="space-y-2">
            {visible.map((item) => {
              const Icon = KIND_ICON[item.kind] ?? Bot;
              const group = statusGroup(item.status);
              const isGen = item.kind === "generation";
              const canCancel = isGen && item.status === "pending";
              const canRetry = isGen && (item.status === "failed" || item.status === "cancelled");
              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-card border border-border hover:shadow-soft transition"
                >
                  <div
                    className={`size-10 rounded-xl grid place-items-center shrink-0 ${
                      group === "active" ? "bg-primary/10" : "bg-secondary"
                    }`}
                  >
                    <Icon
                      className={`size-4 ${
                        group === "active" ? "text-primary animate-pulse" : "text-foreground/70"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{item.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-secondary">
                        {KIND_LABEL[item.kind] ?? item.kind}
                      </span>
                      <span>{item.channel}</span>
                      {group === "active" && item.progress != null && (
                        <span className="text-primary">· {item.progress}%</span>
                      )}
                    </div>
                    {group === "active" && item.progress != null && (
                      <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden max-w-xs">
                        <div
                          className="h-full bg-brand transition-all duration-500"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[group]}`}
                    >
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {item.scheduledAt ? (
                        <span className="inline-flex items-center gap-0.5">
                          <CalendarClock className="size-2.5" />
                          {new Date(item.scheduledAt).toLocaleString("ko-KR", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : (
                        new Date(item.createdAt).toLocaleDateString("ko-KR")
                      )}
                    </div>
                  </div>

                  {(canCancel || canRetry) && (
                    <div className="shrink-0 flex items-center gap-1">
                      {canRetry && (
                        <button
                          onClick={() => void handleRetry(item.id)}
                          disabled={busyId === item.id}
                          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border text-xs hover:bg-secondary disabled:opacity-50"
                          title="재시도"
                        >
                          {busyId === item.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RotateCw className="size-3.5" />
                          )}
                          재시도
                        </button>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => void handleCancel(item.id)}
                          disabled={busyId === item.id}
                          className="size-8 grid place-items-center rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-50"
                          title="취소"
                        >
                          {busyId === item.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <X className="size-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">{icon}</div>
      <div className={`text-2xl font-bold ${accent ?? ""}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function GenIcon({ title }: { title: string }) {
  if (title.includes("이미지")) return <ImageIcon className="size-3.5 text-primary" />;
  if (title.includes("대량") || title.includes("패키지")) return <Package className="size-3.5 text-primary" />;
  if (title.includes("미디어")) return <Sparkles className="size-3.5 text-primary" />;
  return <Bot className="size-3.5 text-primary" />;
}

function EmptyState({ filter }: { filter: string }) {
  return (
    <div className="py-16 text-center">
      <div className="size-14 rounded-2xl bg-secondary grid place-items-center mx-auto mb-3">
        <Layers className="size-6 text-muted-foreground/60" />
      </div>
      <p className="text-sm font-medium">
        {filter === "all" ? "큐가 비어 있습니다" : "해당 상태의 작업이 없습니다"}
      </p>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
        워크스페이스에서 콘텐츠를 생성하거나 발행을 예약하면 여기에서 진행 상황과 진행률을 실시간으로
        추적할 수 있습니다.
      </p>
    </div>
  );
}
