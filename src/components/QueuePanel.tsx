// filepath: src/components/QueuePanel.tsx
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listQueueFn, type QueueItem } from "@/lib/profiles.functions";
import { Loader2, Layers, RefreshCw, Clock, FileText, Send } from "lucide-react";

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
};

const KIND_ICON = {
  schedule: Clock,
  social: Send,
  draft: FileText,
} as const;

export function QueuePanel({ storeCode, storeName }: Props) {
  const listQueue = useServerFn(listQueueFn);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listQueue({ data: { storeCode } });
      setItems(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [listQueue, storeCode]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-secondary/50 overflow-y-auto">
      <div className="px-6 py-5 border-b border-border bg-card flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Layers className="size-5 text-crimson" /> 생성 · 발행 큐
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {storeName ? `${storeName} · ` : ""}예약·드래프트·소셜 발행 작업 {total}건
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
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            대기 중인 작업이 없습니다.
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl">
            {items.map((item) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-card border border-border"
                >
                  <div className="size-9 rounded-xl bg-secondary grid place-items-center shrink-0">
                    <Icon className="size-4 text-foreground/70" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{item.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {item.channel} · {item.kind === "schedule" ? "예약" : item.kind === "social" ? "소셜" : "드래프트"}
                    </div>
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
