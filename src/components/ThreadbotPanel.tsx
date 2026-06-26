// filepath: src/components/ThreadbotPanel.tsx
// 쓰레드봇(ThreadBot) 대시보드 — Threads/Instagram 자동 피드 운영 콘솔.
// 탭: 홈(요약) / 피드 / 활동 기록 / 규칙. 데모 스토어는 더미데이터로 동작.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AtSign,
  Bot,
  Heart,
  MessageSquare,
  SkipForward,
  AlertTriangle,
  Play,
  RefreshCw,
  Loader2,
  Home,
  Newspaper,
  ListChecks,
  Settings2,
  Instagram,
  CheckCircle2,
  Sparkles,
  X,
} from "lucide-react";
import {
  getThreadbotRulesFn,
  saveThreadbotRulesFn,
  toggleThreadbotFn,
  listThreadbotActivityFn,
  getThreadbotSummaryFn,
  runThreadbotOnceFn,
  generateThreadReplyFn,
  listThreadbotAccountsFn,
  logThreadbotActivityFn,
  type ThreadbotRules,
  type ThreadbotActivity,
  type ThreadbotSummary,
  type ThreadbotAccount,
} from "@/lib/threadbot.functions";
import {
  isDemoStore,
  demoThreadbotRules,
  demoThreadbotSummary,
  demoThreadbotActivity,
  demoThreadbotFeed,
  demoThreadbotAccounts,
  type DemoFeedPost,
} from "@/lib/demoData";
import { useThreadbotActivityRealtime } from "@/hooks/useThreadbotActivityRealtime";

type Props = {
  storeCode?: string;
  storeName?: string;
  onRequestOAuth?: () => void;
};
type Tab = "home" | "feed" | "activity" | "rules";

const inputCls =
  "h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary";

const TONE_LABEL: Record<ThreadbotRules["tone"], string> = {
  friendly: "친근",
  professional: "전문",
  humor: "유머",
};

const ACTION_META: Record<
  ThreadbotActivity["action"],
  { label: string; cls: string; Icon: typeof Heart }
> = {
  like: { label: "공감", cls: "bg-rose-500/15 text-rose-600", Icon: Heart },
  reply: { label: "댓글", cls: "bg-primary/10 text-primary", Icon: MessageSquare },
  skip: { label: "스킵", cls: "bg-muted text-muted-foreground", Icon: SkipForward },
  error: { label: "오류", cls: "bg-amber-500/15 text-amber-600", Icon: AlertTriangle },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export function ThreadbotPanel({ storeCode, storeName, onRequestOAuth }: Props) {
  const demo = isDemoStore(storeCode);
  const [tab, setTab] = useState<Tab>("home");
  const [rules, setRules] = useState<ThreadbotRules | null>(null);
  const [summary, setSummary] = useState<ThreadbotSummary>({
    likes: 0,
    replies: 0,
    skips: 0,
    errors: 0,
  });
  const [initialActivity, setInitialActivity] = useState<ThreadbotActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const { items: activity } = useThreadbotActivityRealtime(initialActivity, {
    storeCode: demo ? undefined : storeCode,
    notify: tab === "home",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (demo) {
        setRules(demoThreadbotRules());
        setSummary(demoThreadbotSummary());
        setInitialActivity(demoThreadbotActivity());
      } else {
        const [r, s, a] = await Promise.all([
          getThreadbotRulesFn({ data: { storeCode } }),
          getThreadbotSummaryFn({ data: { storeCode } }),
          listThreadbotActivityFn({ data: { storeCode, limit: 100 } }),
        ]);
        setRules(r.rules);
        setSummary(s.summary);
        setInitialActivity(a.items);
      }
    } catch (e) {
      toast.error("쓰레드봇 데이터를 불러오지 못했습니다.", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [demo, storeCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleBot = async (enabled: boolean) => {
    setRules((prev) => (prev ? { ...prev, botEnabled: enabled } : prev));
    if (demo) {
      toast.success(enabled ? "봇을 켰습니다 (데모)" : "봇을 껐습니다 (데모)");
      return;
    }
    try {
      await toggleThreadbotFn({ data: { storeCode, enabled } });
    } catch (e) {
      setRules((prev) => (prev ? { ...prev, botEnabled: !enabled } : prev));
      toast.error("봇 상태 변경 실패", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const runOnce = async () => {
    setRunning(true);
    try {
      if (demo) {
        await new Promise((r) => setTimeout(r, 700));
        toast.success("실행 요청 등록 (데모)", {
          description: "봇 워커가 피드를 스캔하고 활동 로그에 기록합니다.",
        });
      } else {
        const res = await runThreadbotOnceFn({ data: { storeCode } });
        toast.success("실행 요청 완료", { description: res.message });
        await load();
      }
    } catch (e) {
      toast.error("실행 실패", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setRunning(false);
    }
  };

  const refreshSummary = useCallback(async () => {
    if (demo || !storeCode) return;
    try {
      const s = await getThreadbotSummaryFn({ data: { storeCode } });
      setSummary(s.summary);
    } catch {
      /* ignore */
    }
  }, [demo, storeCode]);

  const logActivity = useCallback(
    async (input: {
      platform: DemoFeedPost["platform"];
      action: ThreadbotActivity["action"];
      post: DemoFeedPost;
      replyText?: string;
      aiReason?: string;
    }) => {
      if (demo) {
        toast.success(
          input.action === "like"
            ? "공감 완료 (데모)"
            : input.action === "reply"
              ? "댓글 게시 완료 (데모)"
              : "스킵 처리 (데모)"
        );
        return;
      }
      try {
        await logThreadbotActivityFn({
          data: {
            storeCode,
            platform: input.platform,
            action: input.action,
            targetUsername: input.post.username,
            postId: input.post.id,
            postPreview: input.post.text.slice(0, 200),
            replyText: input.replyText ?? null,
            aiReason: input.aiReason ?? null,
          },
        });
        await refreshSummary();
        toast.success(
          input.action === "like"
            ? "공감 기록됨"
            : input.action === "reply"
              ? "댓글 게시 기록됨"
              : "스킵 기록됨",
          { description: rules?.dryRun ? "DRY RUN 모드 — 실제 게시는 하지 않습니다." : undefined }
        );
      } catch (e) {
        toast.error("활동 기록 실패", {
          description: e instanceof Error ? e.message : undefined,
        });
      }
    },
    [demo, storeCode, rules?.dryRun, refreshSummary]
  );

  if (loading && !rules) {
    return (
      <div className="flex-1 grid place-items-center bg-secondary/50">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-secondary/50" translate="no">
      {/* 헤더 */}
      <div className="px-6 pt-5 pb-0 bg-card border-b border-border">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-11 rounded-2xl bg-gradient-to-br from-primary to-accent grid place-items-center shrink-0">
              <AtSign className="size-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                쓰레드봇
                {demo && (
                  <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-violet-500/15 text-violet-600">
                    DEMO
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Threads·Instagram 피드를 AI가 규칙대로 공감·댓글하고 전부 기록하는 운영 콘솔
                {storeName ? ` · ${storeName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <BotStatusBadge rules={rules} />
            <button
              onClick={() => void runOnce()}
              disabled={running}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-brand text-primary-foreground text-xs font-semibold hover:opacity-90 transition disabled:opacity-60"
            >
              {running ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
              지금 1회 실행
            </button>
            <MasterSwitch
              on={!!rules?.botEnabled}
              onChange={(v) => void toggleBot(v)}
            />
          </div>
        </div>

        {/* 탭 */}
        <div className="flex items-center gap-1">
          {([
            ["home", "홈", Home],
            ["feed", "피드", Newspaper],
            ["activity", "활동 기록", ListChecks],
            ["rules", "규칙", Settings2],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                tab === id
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "home" && (
          <HomeView
            summary={summary}
            activity={activity}
            rules={rules}
            onRefresh={() => void load()}
            loading={loading}
            demo={demo}
            storeCode={storeCode}
            onRequestOAuth={onRequestOAuth}
          />
        )}
        {tab === "feed" && (
          <FeedView
            demo={demo}
            storeCode={storeCode}
            rules={rules}
            onLogActivity={logActivity}
          />
        )}
        {tab === "activity" && <ActivityView activity={activity} onRefresh={() => void load()} />}
        {tab === "rules" && rules && (
          <RulesView
            rules={rules}
            demo={demo}
            storeCode={storeCode}
            onSaved={(r) => setRules(r)}
          />
        )}
      </div>
    </div>
  );
}

function BotStatusBadge({ rules }: { rules: ThreadbotRules | null }) {
  if (!rules) return null;
  if (!rules.botEnabled)
    return (
      <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-muted text-muted-foreground">
        Paused
      </span>
    );
  if (rules.dryRun)
    return (
      <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-violet-500/15 text-violet-600">
        DRY RUN
      </span>
    );
  return (
    <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-emerald-500/15 text-emerald-600">
      Running
    </span>
  );
}

function MasterSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-9 w-[72px] items-center rounded-full px-1 transition ${
        on ? "bg-emerald-500" : "bg-muted"
      }`}
      title="봇 마스터 스위치"
    >
      <span
        className={`absolute text-[10px] font-bold ${on ? "left-2.5 text-white" : "right-2 text-muted-foreground"}`}
      >
        {on ? "ON" : "OFF"}
      </span>
      <span
        className={`size-7 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[38px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/* ============================ 홈 ============================ */
function HomeView({
  summary,
  activity,
  rules,
  onRefresh,
  loading,
  demo,
  storeCode,
  onRequestOAuth,
}: {
  summary: ThreadbotSummary;
  activity: ThreadbotActivity[];
  rules: ThreadbotRules | null;
  onRefresh: () => void;
  loading: boolean;
  demo: boolean;
  storeCode?: string;
  onRequestOAuth?: () => void;
}) {
  const kpis = [
    { label: "오늘 공감", value: summary.likes, Icon: Heart, cls: "text-rose-500" },
    { label: "오늘 댓글", value: summary.replies, Icon: MessageSquare, cls: "text-primary" },
    { label: "오늘 스킵", value: summary.skips, Icon: SkipForward, cls: "text-muted-foreground" },
    { label: "오늘 실패", value: summary.errors, Icon: AlertTriangle, cls: "text-amber-500" },
  ];
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-2xl p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{k.label}</span>
              <k.Icon className={`size-4 ${k.cls}`} />
            </div>
            <div className="mt-2 font-display text-3xl font-bold">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 타임라인 */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-soft">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-display font-semibold flex items-center gap-2">
              <Bot className="size-4 text-primary" /> 최근 활동
            </h3>
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border text-xs hover:bg-secondary transition"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> 새로고침
            </button>
          </div>
          <div className="divide-y divide-border max-h-[460px] overflow-y-auto">
            {activity.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                아직 활동이 없어요. 봇을 켜고 “지금 1회 실행”을 눌러보세요.
              </div>
            ) : (
              activity.slice(0, 12).map((a) => {
                const meta = ACTION_META[a.action];
                return (
                  <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                    <span className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${meta.cls}`}>
                      <meta.Icon className="size-3" /> {meta.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium">{a.targetUsername ?? "—"}</span>
                        <span className="text-muted-foreground/60">{a.platform}</span>
                        <span className="text-muted-foreground/60">· {timeAgo(a.createdAt)}</span>
                      </div>
                      {a.postPreview && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {a.postPreview}
                        </p>
                      )}
                      {a.replyText && (
                        <p className="text-xs text-foreground/80 mt-1 italic">“{a.replyText}”</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 계정 + 요약 */}
        <div className="grid gap-6 content-start">
          <AccountsCard demo={demo} storeCode={storeCode} onRequestOAuth={onRequestOAuth} />
          {rules && (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
              <h3 className="font-display font-semibold mb-3">현재 규칙 요약</h3>
              <ul className="space-y-2 text-xs">
                <Row k="모드" v={rules.dryRun ? "DRY RUN (시뮬레이션)" : "실제 운영"} />
                <Row k="자동 공감 / 댓글" v={`${rules.enableLike ? "ON" : "OFF"} / ${rules.enableReply ? "ON" : "OFF"}`} />
                <Row k="일일 한도" v={`공감 ${rules.dailyLikeLimit} · 댓글 ${rules.dailyReplyLimit}`} />
                <Row k="실행 시간대" v={`${rules.activeHoursStart}~${rules.activeHoursEnd}`} />
                <Row k="댓글 톤" v={TONE_LABEL[rules.tone]} />
                <Row k="AI 모델" v={rules.aiModel} />
                {rules.lastRunAt && <Row k="마지막 실행" v={timeAgo(rules.lastRunAt)} />}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v}</span>
    </li>
  );
}

function AccountsCard({
  demo,
  storeCode,
  onRequestOAuth,
}: {
  demo: boolean;
  storeCode?: string;
  onRequestOAuth?: () => void;
}) {
  const [accounts, setAccounts] = useState<ThreadbotAccount[]>(() =>
    demo ? demoThreadbotAccounts() : []
  );
  const [loading, setLoading] = useState(!demo);

  useEffect(() => {
    if (demo) {
      setAccounts(demoThreadbotAccounts());
      setLoading(false);
      return;
    }
    if (!storeCode) return;
    let cancelled = false;
    setLoading(true);
    void listThreadbotAccountsFn({ data: { storeCode } })
      .then((res) => {
        if (!cancelled) setAccounts(res.accounts);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [demo, storeCode]);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
      <h3 className="font-display font-semibold mb-3">연동 계정</h3>
      {loading ? (
        <div className="py-6 grid place-items-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => (
            <div key={acc.platform} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {acc.platform === "threads" ? (
                  <AtSign className="size-4 text-foreground" />
                ) : (
                  <Instagram className="size-4 text-pink-500" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium capitalize">{acc.platform}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {acc.username ?? "미연결"}
                  </div>
                </div>
              </div>
              {acc.status === "connected" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-emerald-500/15 text-emerald-600">
                  <CheckCircle2 className="size-3" /> 연결됨
                  {acc.expiresInDays != null && ` · ${acc.expiresInDays}일`}
                </span>
              ) : acc.status === "expired" ? (
                <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-amber-500/15 text-amber-600">
                  토큰 만료
                </span>
              ) : acc.status === "needs_business" ? (
                <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-amber-500/15 text-amber-600">
                  Business 전환 필요
                </span>
              ) : (
                <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
                  미연결
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => onRequestOAuth?.()}
        className="mt-4 w-full h-9 rounded-xl border border-border text-xs font-medium hover:bg-secondary transition"
      >
        Meta 계정 연결 관리
      </button>
    </div>
  );
}

/* ============================ 피드 ============================ */
function FeedView({
  demo,
  storeCode,
  rules,
  onLogActivity,
}: {
  demo: boolean;
  storeCode?: string;
  rules: ThreadbotRules | null;
  onLogActivity: (input: {
    platform: DemoFeedPost["platform"];
    action: ThreadbotActivity["action"];
    post: DemoFeedPost;
    replyText?: string;
    aiReason?: string;
  }) => Promise<void>;
}) {
  const [posts] = useState<DemoFeedPost[]>(() => demoThreadbotFeed());
  const [filter, setFilter] = useState<"all" | "threads" | "instagram">("all");
  const [replyFor, setReplyFor] = useState<DemoFeedPost | null>(null);
  const [reply, setReply] = useState("");
  const [genLoading, setGenLoading] = useState(false);

  const visible = posts.filter((p) => filter === "all" || p.platform === filter);

  const genReply = async (post: DemoFeedPost) => {
    setReplyFor(post);
    setReply("");
    setGenLoading(true);
    try {
      if (demo) {
        await new Promise((r) => setTimeout(r, 800));
        setReply(`${post.username.replace("@", "")}님 글 잘 봤어요! 정말 공감돼요 :)`);
      } else {
        const res = await generateThreadReplyFn({
          data: { storeCode, postText: post.text, tone: rules?.tone ?? "friendly" },
        });
        if (!res.reply) {
          toast.info("AI 판단: 스킵 권장", { description: res.reason });
          setReplyFor(null);
        } else {
          setReply(res.reply);
        }
      }
    } catch (e) {
      toast.error("AI 댓글 생성 실패", {
        description: e instanceof Error ? e.message : undefined,
      });
      setReplyFor(null);
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <div className="grid gap-4">
      {!demo && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          피드 미리보기는 샘플 데이터입니다. Meta API 워커 연동 후 실제 피드가 표시됩니다. 공감·댓글·스킵은
          활동 로그에 기록됩니다{rules?.dryRun ? " (DRY RUN)" : ""}.
        </div>
      )}
      <div className="flex items-center gap-2">
        {(["all", "threads", "instagram"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-8 px-3 rounded-full text-xs font-medium transition ${
              filter === f
                ? "bg-brand text-primary-foreground shadow-soft"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "전체" : f === "threads" ? "Threads" : "Instagram"}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          규칙에 걸리는 글은 자동 처리 “예정” 배지가 표시됩니다
        </span>
      </div>

      <div className="grid gap-3">
        {visible.map((p) => (
          <article key={p.id} className="bg-card border border-border rounded-2xl p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <div
                className="size-9 rounded-full shrink-0 grid place-items-center text-white text-xs font-bold"
                style={{ background: p.avatarColor }}
              >
                {p.username.replace("@", "").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="font-semibold">{p.username}</span>
                  <span className="text-muted-foreground/60">· {p.postedAgo}</span>
                  <span className="text-muted-foreground/60 capitalize">· {p.platform}</span>
                  {p.planned === "like_reply" && (
                    <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-primary/10 text-primary">
                      🤖 자동 처리 예정
                    </span>
                  )}
                  {p.planned === "skip" && (
                    <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
                      스킵 예정
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed">{p.text}</p>
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="size-3.5" /> {p.likes}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="size-3.5" /> {p.comments}
                  </span>
                  <span className="text-muted-foreground/60">{p.planReason}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => void onLogActivity({ platform: p.platform, action: "like", post: p })}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-border text-xs hover:bg-secondary transition"
                  >
                    <Heart className="size-3.5" /> 공감
                  </button>
                  <button
                    onClick={() => void genReply(p)}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-brand text-primary-foreground text-xs font-medium hover:opacity-90 transition"
                  >
                    <Sparkles className="size-3.5" /> AI 댓글
                  </button>
                  <button
                    onClick={() => void onLogActivity({ platform: p.platform, action: "skip", post: p, aiReason: p.planReason })}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-border text-xs hover:bg-secondary transition"
                  >
                    <SkipForward className="size-3.5" /> 스킵
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* AI 댓글 미리보기 */}
      {replyFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setReplyFor(null)}>
          <div
            className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <Sparkles className="size-4 text-primary" /> AI 댓글 미리보기
              </h3>
              <button onClick={() => setReplyFor(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <div className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground mb-3">
              <span className="font-medium text-foreground">{replyFor.username}</span> · {replyFor.text}
            </div>
            {genLoading ? (
              <div className="h-24 grid place-items-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : (
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border bg-background p-3 text-sm resize-none"
                placeholder="AI가 생성한 댓글을 검토·수정한 뒤 게시하세요."
              />
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => void genReply(replyFor)}
                disabled={genLoading}
                className="inline-flex items-center gap-1 h-9 px-3 rounded-xl border border-border text-xs font-medium hover:bg-secondary transition disabled:opacity-60"
              >
                <RefreshCw className="size-3.5" /> 다시 생성
              </button>
              <button
                onClick={() => {
                  void onLogActivity({
                    platform: replyFor.platform,
                    action: "reply",
                    post: replyFor,
                    replyText: reply,
                    aiReason: "수동 검토 후 게시",
                  });
                  setReplyFor(null);
                }}
                disabled={genLoading || !reply.trim()}
                className="inline-flex items-center gap-1 h-9 px-4 rounded-xl bg-brand text-primary-foreground text-xs font-semibold hover:opacity-90 transition disabled:opacity-60"
              >
                <MessageSquare className="size-3.5" /> 게시
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ 활동 기록 ============================ */
function ActivityView({
  activity,
  onRefresh,
}: {
  activity: ThreadbotActivity[];
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<"all" | ThreadbotActivity["action"]>("all");
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: activity.length };
    for (const a of activity) c[a.action] = (c[a.action] ?? 0) + 1;
    return c;
  }, [activity]);
  const visible = activity.filter((a) => filter === "all" || a.action === filter);

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "like", "reply", "skip", "error"] as const).map((f) => {
          const label = f === "all" ? "전체" : ACTION_META[f].label;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition ${
                filter === f
                  ? "bg-brand text-primary-foreground shadow-soft"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              <span className={`text-[10px] px-1.5 rounded-full ${filter === f ? "bg-white/20" : "bg-card border border-border"}`}>
                {counts[f] ?? 0}
              </span>
            </button>
          );
        })}
        <button
          onClick={onRefresh}
          className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs hover:bg-secondary transition"
        >
          <RefreshCw className="size-3.5" /> 새로고침
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
        {visible.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">표시할 활동이 없습니다.</div>
        ) : (
          <div className="divide-y divide-border">
            {visible.map((a) => {
              const meta = ACTION_META[a.action];
              return (
                <div key={a.id} className="px-5 py-3.5 flex items-start gap-3">
                  <span className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${meta.cls}`}>
                    <meta.Icon className="size-3" /> {meta.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="font-medium">{a.targetUsername ?? "—"}</span>
                      <span className="text-muted-foreground/60 capitalize">{a.platform}</span>
                      <span className="text-muted-foreground/60">· {timeAgo(a.createdAt)}</span>
                      <StatusPill status={a.status} />
                    </div>
                    {a.postPreview && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.postPreview}</p>
                    )}
                    {a.replyText && (
                      <p className="text-xs text-foreground/80 mt-1 italic">“{a.replyText}”</p>
                    )}
                    {a.aiReason && (
                      <p className="text-[11px] text-muted-foreground/70 mt-1">AI 판단: {a.aiReason}</p>
                    )}
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

function StatusPill({ status }: { status: ThreadbotActivity["status"] }) {
  const map = {
    success: { label: "성공", cls: "bg-emerald-500/15 text-emerald-600" },
    failed: { label: "실패", cls: "bg-amber-500/15 text-amber-600" },
    dry_run: { label: "DRY RUN", cls: "bg-violet-500/15 text-violet-600" },
  } as const;
  const m = map[status];
  return <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${m.cls}`}>{m.label}</span>;
}

/* ============================ 규칙 ============================ */
function RulesView({
  rules,
  demo,
  storeCode,
  onSaved,
}: {
  rules: ThreadbotRules;
  demo: boolean;
  storeCode?: string;
  onSaved: (r: ThreadbotRules) => void;
}) {
  const [draft, setDraft] = useState<ThreadbotRules>(rules);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ThreadbotRules>(k: K, v: ThreadbotRules[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const applyPreset = (preset: "low" | "balanced" | "high") => {
    const map = {
      low: { dailyLikeLimit: 8, dailyReplyLimit: 3, runIntervalMinutes: 240 },
      balanced: { dailyLikeLimit: 20, dailyReplyLimit: 10, runIntervalMinutes: 120 },
      high: { dailyLikeLimit: 40, dailyReplyLimit: 20, runIntervalMinutes: 60 },
    }[preset];
    setDraft((d) => ({ ...d, ...map }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const patch = {
        dryRun: draft.dryRun,
        enableLike: draft.enableLike,
        enableReply: draft.enableReply,
        dailyLikeLimit: draft.dailyLikeLimit,
        dailyReplyLimit: draft.dailyReplyLimit,
        runIntervalMinutes: draft.runIntervalMinutes,
        activeHoursStart: draft.activeHoursStart,
        activeHoursEnd: draft.activeHoursEnd,
        keywordsInclude: draft.keywordsInclude,
        keywordsExclude: draft.keywordsExclude,
        tone: draft.tone,
        minPostLength: draft.minPostLength,
        aiModel: draft.aiModel,
      };
      if (demo) {
        await new Promise((r) => setTimeout(r, 500));
        onSaved({ ...draft });
        toast.success("규칙을 저장했습니다 (데모)");
      } else {
        const res = await saveThreadbotRulesFn({ data: { storeCode, patch } });
        onSaved(res.rules);
        setDraft(res.rules);
        toast.success("규칙을 저장했습니다");
      }
    } catch (e) {
      toast.error("저장 실패", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl grid gap-5">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">프리셋:</span>
        {([
          ["low", "소극 모드"],
          ["balanced", "균형 모드"],
          ["high", "활발 모드"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => applyPreset(id)}
            className="h-8 px-3 rounded-full text-xs font-medium bg-secondary text-muted-foreground hover:text-foreground transition"
          >
            {label}
          </button>
        ))}
      </div>

      <Card title="실행 동작">
        <ToggleRow label="DRY RUN (실제 클릭 없이 시뮬레이션)" desc="안전을 위해 처음엔 켜두세요" on={draft.dryRun} onChange={(v) => set("dryRun", v)} />
        <ToggleRow label="자동 공감" on={draft.enableLike} onChange={(v) => set("enableLike", v)} />
        <ToggleRow label="자동 댓글" on={draft.enableReply} onChange={(v) => set("enableReply", v)} />
      </Card>

      <Card title="한도 · 스케줄">
        <SliderRow label="일일 공감 한도" min={0} max={50} value={draft.dailyLikeLimit} onChange={(v) => set("dailyLikeLimit", v)} />
        <SliderRow label="일일 댓글 한도" min={0} max={30} value={draft.dailyReplyLimit} onChange={(v) => set("dailyReplyLimit", v)} />
        <div className="grid grid-cols-2 gap-4 pt-2">
          <Field label="실행 시작 시간">
            <input type="time" value={draft.activeHoursStart} onChange={(e) => set("activeHoursStart", e.target.value)} className={inputCls} />
          </Field>
          <Field label="실행 종료 시간">
            <input type="time" value={draft.activeHoursEnd} onChange={(e) => set("activeHoursEnd", e.target.value)} className={inputCls} />
          </Field>
          <Field label="실행 주기(분)">
            <input type="number" min={15} value={draft.runIntervalMinutes} onChange={(e) => set("runIntervalMinutes", Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="최소 글 길이(자)">
            <input type="number" min={0} value={draft.minPostLength} onChange={(e) => set("minPostLength", Number(e.target.value))} className={inputCls} />
          </Field>
        </div>
      </Card>

      <Card title="키워드 필터">
        <Field label="포함 키워드 (비우면 전체)">
          <TagInput tags={draft.keywordsInclude} onChange={(t) => set("keywordsInclude", t)} placeholder="예: 카페, 디저트" />
        </Field>
        <Field label="제외 키워드">
          <TagInput tags={draft.keywordsExclude} onChange={(t) => set("keywordsExclude", t)} placeholder="예: 광고, 홍보" />
        </Field>
      </Card>

      <Card title="AI 댓글">
        <Field label="댓글 톤">
          <div className="flex items-center gap-2">
            {(["friendly", "professional", "humor"] as const).map((t) => (
              <button
                key={t}
                onClick={() => set("tone", t)}
                className={`h-9 px-4 rounded-xl text-xs font-medium transition ${
                  draft.tone === t ? "bg-brand text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {TONE_LABEL[t]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="AI 모델">
          <select value={draft.aiModel} onChange={(e) => set("aiModel", e.target.value)} className={inputCls}>
            <option value="gemini-2.5-flash">gemini-2.5-flash</option>
            <option value="gemini-2.5-pro">gemini-2.5-pro</option>
            <option value="gemini-2.0-flash">gemini-2.0-flash</option>
          </select>
        </Field>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setDraft(rules)}
          className="h-10 px-4 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition"
        >
          되돌리기
        </button>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-brand text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          규칙 저장
        </button>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
      <h3 className="font-display font-semibold mb-4">{title}</h3>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  desc,
  on,
  onChange,
}: {
  label: string;
  desc?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-[11px] text-muted-foreground">{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!on)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${on ? "bg-brand" : "bg-muted"}`}
      >
        <span className={`size-5 rounded-full bg-white shadow transition-transform mx-0.5 ${on ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function SliderRow({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-bold text-primary">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim().replace(/,$/, "");
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-background p-2 min-h-[42px]">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 text-xs bg-secondary rounded-full px-2 py-1">
          {t}
          <button onClick={() => onChange(tags.filter((x) => x !== t))} className="text-muted-foreground hover:text-foreground">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        className="flex-1 min-w-[100px] bg-transparent text-sm outline-none px-1"
      />
    </div>
  );
}
