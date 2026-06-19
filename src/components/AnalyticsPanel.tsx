// filepath: src/components/AnalyticsPanel.tsx
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAnalyticsFn, type AnalyticsSummary } from "@/lib/profiles.functions";
import { SOCIAL_PLATFORM_LABELS, type SocialPlatform } from "@/lib/social/types";
import { Activity, Loader2, RefreshCw, TrendingUp, CheckCircle2, AlertCircle, Clock } from "lucide-react";

type Props = {
  storeCode?: string;
  storeName?: string;
};

export function AnalyticsPanel({ storeCode, storeName }: Props) {
  const getAnalytics = useServerFn(getAnalyticsFn);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAnalytics({ data: { storeCode } });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [getAnalytics, storeCode]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-secondary/50 overflow-y-auto">
      <div className="px-6 py-5 border-b border-border bg-card flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Activity className="size-5 text-primary" /> 성과 리포트
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {storeName ? `${storeName} · ` : ""}소셜 발행 통계
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

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin inline mr-2" />
            통계 로딩 중…
          </div>
        ) : !data ? null : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl">
              <StatCard
                icon={<CheckCircle2 className="size-4 text-emerald-500" />}
                label="총 발행"
                value={String(data.totalPublished)}
              />
              <StatCard
                icon={<TrendingUp className="size-4 text-primary" />}
                label="이번 달"
                value={String(data.publishedThisMonth)}
              />
              <StatCard
                icon={<Clock className="size-4 text-amber-500" />}
                label="예약 대기"
                value={String(data.totalScheduled)}
              />
              <StatCard
                icon={<AlertCircle className="size-4 text-accent" />}
                label="발행 성공률"
                value={`${data.successRate}%`}
              />
            </div>

            {Object.keys(data.byPlatform).length > 0 && (
              <div className="rounded-2xl bg-card border border-border p-5 max-w-5xl">
                <h3 className="text-sm font-semibold mb-4">플랫폼별 발행</h3>
                <div className="space-y-3">
                  {Object.entries(data.byPlatform).map(([platform, count]) => {
                    const max = Math.max(...Object.values(data.byPlatform), 1);
                    const pct = Math.round((count / max) * 100);
                    const label =
                      SOCIAL_PLATFORM_LABELS[platform as SocialPlatform] ?? platform;
                    return (
                      <div key={platform}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{label}</span>
                          <span className="text-muted-foreground">{count}건</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-card border border-border p-5 max-w-5xl">
              <h3 className="text-sm font-semibold mb-4">최근 발행 기록</h3>
              {data.recentPosts.length === 0 ? (
                <p className="text-sm text-muted-foreground">발행 기록이 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {data.recentPosts.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-start gap-3 px-3 py-2 rounded-xl bg-secondary/50 text-xs"
                    >
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded font-semibold ${
                          p.status === "published"
                            ? "bg-emerald-100 text-emerald-700"
                            : p.status === "failed"
                              ? "bg-red-100 text-red-700"
                              : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {p.status}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{p.caption || "(본문 없음)"}</div>
                        <div className="text-muted-foreground mt-0.5">
                          {SOCIAL_PLATFORM_LABELS[p.platform as SocialPlatform] ?? p.platform} ·{" "}
                          {new Date(p.publishedAt ?? p.createdAt).toLocaleString("ko-KR")}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
