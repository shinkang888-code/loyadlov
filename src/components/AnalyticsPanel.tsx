// filepath: src/components/AnalyticsPanel.tsx
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAnalyticsFn, type AnalyticsSummary } from "@/lib/profiles.functions";
import { getGaReportFn } from "@/lib/aiIntegrations.functions";
import { SOCIAL_PLATFORM_LABELS, type SocialPlatform } from "@/lib/social/types";
import {
  Activity,
  Loader2,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Eye,
  MousePointerClick,
  UserPlus,
} from "lucide-react";

type Props = {
  storeCode?: string;
  storeName?: string;
};

type GaRange = "7d" | "28d" | "90d";

type GaReport = {
  totals: {
    activeUsers: number;
    newUsers: number;
    sessions: number;
    screenPageViews: number;
    avgSessionDurationSec: number;
    bounceRate: number;
  };
  daily: { date: string; activeUsers: number; screenPageViews: number }[];
  topPages: { title: string; views: number }[];
  channels: { channel: string; sessions: number }[];
};

export function AnalyticsPanel({ storeCode, storeName }: Props) {
  const getAnalytics = useServerFn(getAnalyticsFn);
  const getGaReport = useServerFn(getGaReportFn);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [gaRange, setGaRange] = useState<GaRange>("28d");
  const [gaLoading, setGaLoading] = useState(true);
  const [ga, setGa] = useState<GaReport | null>(null);
  const [gaError, setGaError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAnalytics({ data: { storeCode } });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [getAnalytics, storeCode]);

  const loadGa = useCallback(async () => {
    setGaLoading(true);
    setGaError(null);
    try {
      const res = await getGaReport({ data: { range: gaRange } });
      if (res.configured) {
        setGa(res.report as GaReport);
      } else {
        setGa(null);
        setGaError(res.error ?? "GA 미설정");
      }
    } catch (e) {
      setGa(null);
      setGaError(e instanceof Error ? e.message : "GA 리포트를 불러오지 못했습니다.");
    } finally {
      setGaLoading(false);
    }
  }, [getGaReport, gaRange]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadGa();
  }, [loadGa]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-secondary/50 overflow-y-auto">
      <div className="px-6 py-5 border-b border-border bg-card flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Activity className="size-5 text-primary" /> 성과 리포트
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {storeName ? `${storeName} · ` : ""}Google Analytics 방문자 + 소셜 발행 통계
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void load();
            void loadGa();
          }}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border text-xs font-medium hover:bg-secondary transition"
        >
          <RefreshCw className={`size-3.5 ${loading || gaLoading ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* === Google Analytics 방문자 리포트 === */}
        <div className="max-w-5xl space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="size-4 text-primary" /> 방문자 리포트 (Google Analytics)
            </h3>
            <div className="flex gap-1">
              {(["7d", "28d", "90d"] as GaRange[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setGaRange(r)}
                  className={`h-7 px-2.5 rounded-lg text-[11px] font-medium border ${
                    gaRange === r
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border text-muted-foreground"
                  }`}
                >
                  {r === "7d" ? "7일" : r === "28d" ? "28일" : "90일"}
                </button>
              ))}
            </div>
          </div>

          {gaLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin inline mr-2" /> GA 데이터 로딩 중…
            </div>
          ) : !ga ? (
            <div className="rounded-2xl bg-card border border-border p-5 text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Google Analytics가 아직 연결되지 않았습니다.</p>
              <p className="text-xs">{gaError}</p>
              <ol className="text-xs list-decimal list-inside space-y-1 mt-2">
                <li>「설정 &amp; API」 → AI &amp; 앱에서 <strong>GA4 속성 ID</strong>(GA_PROPERTY_ID)를 입력하세요.</li>
                <li>구글 서비스 계정 이메일을 GA4 속성의 <strong>뷰어</strong>로 추가하세요. (Drive와 동일 계정)</li>
              </ol>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={<Users className="size-4 text-primary" />}
                  label="방문자 수 (활성 사용자)"
                  value={ga.totals.activeUsers.toLocaleString()}
                />
                <StatCard
                  icon={<UserPlus className="size-4 text-emerald-500" />}
                  label="신규 방문자"
                  value={ga.totals.newUsers.toLocaleString()}
                />
                <StatCard
                  icon={<MousePointerClick className="size-4 text-amber-500" />}
                  label="세션"
                  value={ga.totals.sessions.toLocaleString()}
                />
                <StatCard
                  icon={<Eye className="size-4 text-accent" />}
                  label="페이지뷰"
                  value={ga.totals.screenPageViews.toLocaleString()}
                />
              </div>

              {ga.daily.length > 0 && (
                <div className="rounded-2xl bg-card border border-border p-5">
                  <h4 className="text-xs font-semibold mb-3 text-muted-foreground">일자별 방문자 추이</h4>
                  <div className="flex items-end gap-1 h-28">
                    {ga.daily.map((d) => {
                      const max = Math.max(...ga.daily.map((x) => x.activeUsers), 1);
                      const h = Math.round((d.activeUsers / max) * 100);
                      return (
                        <div
                          key={d.date}
                          className="flex-1 bg-brand/80 rounded-t hover:bg-brand transition"
                          style={{ height: `${Math.max(h, 2)}%` }}
                          title={`${d.date} · 방문자 ${d.activeUsers} · 페이지뷰 ${d.screenPageViews}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                    <span>{ga.daily[0]?.date}</span>
                    <span>{ga.daily[ga.daily.length - 1]?.date}</span>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-card border border-border p-5">
                  <h4 className="text-xs font-semibold mb-3 text-muted-foreground">인기 페이지 TOP 5</h4>
                  {ga.topPages.length === 0 ? (
                    <p className="text-xs text-muted-foreground">데이터 없음</p>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {ga.topPages.map((p) => (
                        <li key={p.title} className="flex justify-between gap-2">
                          <span className="truncate">{p.title}</span>
                          <span className="text-muted-foreground shrink-0">{p.views.toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-2xl bg-card border border-border p-5">
                  <h4 className="text-xs font-semibold mb-3 text-muted-foreground">유입 채널</h4>
                  {ga.channels.length === 0 ? (
                    <p className="text-xs text-muted-foreground">데이터 없음</p>
                  ) : (
                    <div className="space-y-2">
                      {ga.channels.map((c) => {
                        const max = Math.max(...ga.channels.map((x) => x.sessions), 1);
                        const pct = Math.round((c.sessions / max) * 100);
                        return (
                          <div key={c.channel}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium truncate">{c.channel}</span>
                              <span className="text-muted-foreground">{c.sessions.toLocaleString()}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="max-w-5xl border-t border-border pt-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="size-4 text-primary" /> 소셜 발행 통계
          </h3>
        </div>

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
