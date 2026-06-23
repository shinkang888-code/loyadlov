import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateContent } from "@/lib/ai.functions";
import { saveDraft, scheduleDraft, listSchedule, unscheduleSlot, getStoreDrivePathFn, listDrafts, type ScheduleRow } from "@/lib/drafts.functions";
import { generateVideoStoryboard } from "@/lib/video.functions";
import { streamImage } from "@/lib/streamImage";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Users,
  LayoutDashboard,
  Wand2,
  Send,
  Cloud,
  ShieldCheck,
  Settings,
  Bell,
  Plus,
  Sparkles,
  Image as ImageIcon,
  Type,
  Film,
  Instagram,
  Music2,
  MessageCircle,
  Globe,
  Check,
  Loader2,
  Copy,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  Calendar,
  Hash,
  Bot,
  Layers,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  FolderOpen,
  Youtube,
  PenLine,
} from "lucide-react";
import logo from "@/assets/loyard-logo.jpg";
import showcase1 from "@/assets/showcase-1.jpg";
import showcase2 from "@/assets/showcase-2.jpg";
import showcase3 from "@/assets/showcase-3.jpg";
import { LeadsPanel } from "@/components/LeadsPanel";
import { AssetsPanel } from "@/components/AssetsPanel";
import { SocialPublishPanel } from "@/components/SocialPublishPanel";
import { PlatformSetupWizard } from "@/components/PlatformSetupWizard";
import { SetupBanner } from "@/components/SetupBanner";
import { ChannelOAuthConnectDialog } from "@/components/ChannelOAuthConnectDialog";
import { QueuePanel } from "@/components/QueuePanel";
import { MembersPanel } from "@/components/MembersPanel";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { BulkGenerateDialog } from "@/components/BulkGenerateDialog";
import { BlogComposerPanel } from "@/components/BlogComposerPanel";
import { MediaStudioPanel } from "@/components/MediaStudioPanel";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import { JobNotificationsBell } from "@/components/JobNotificationsBell";
import { useSocialAccounts } from "@/hooks/useSocialAccounts";
import {
  createSocialPostFn,
  publishSocialPostFn,
} from "@/lib/social.functions";
import {
  getCurrentUserFn,
  listActivityFn,
  listQueueFn,
  listStoresFn,
  type StoreSummary,
} from "@/lib/profiles.functions";
import {
  ALL_SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  PLATFORM_HINT,
  type SocialPlatform,
} from "@/lib/social/types";
import { computeToneMatchScore, describeToneMatch } from "@/lib/toneAnalysis";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — 로이어드 Loyard" },
      { name: "description", content: "로이어드 운영 크루 전용 AI 콘트롤 센터" },
    ],
  }),
  component: AdminConsole,
});

/* ---------------- Store / client types ---------------- */
type Client = {
  uid: string;
  store: string;
  industry: string;
  tone: string[];
  channels: ("ig" | "tt" | "yt" | "nv" | "kk")[];
  avatar: string;
  status: "active" | "pending" | "needs-auth";
  thisMonth: number;
  plan: string;
  queuedCount: number;
};

const AVATAR_IMAGES = [showcase1, showcase2, showcase3];

function storeToClient(s: StoreSummary, index: number): Client {
  const channels = new Set<Client["channels"][number]>();
  for (const p of s.connectedPlatforms) {
    if (p === "instagram" || p === "threads") channels.add("ig");
    if (p === "tiktok") channels.add("tt");
    if (p === "youtube") channels.add("yt");
    if (p === "naver_blog") channels.add("nv");
    if (p === "kakao") channels.add("kk");
  }
  if (s.instagramHandle) channels.add("ig");
  if (s.naverHandle) channels.add("nv");
  if (channels.size === 0) channels.add("ig");

  return {
    uid: s.storeCode,
    store: s.businessName,
    industry: s.industry,
    tone: s.toneTags,
    channels: [...channels],
    avatar: AVATAR_IMAGES[index % AVATAR_IMAGES.length],
    status: s.status,
    thisMonth: s.publishedThisMonth,
    plan: s.plan,
    queuedCount: s.queuedCount,
  };
}

const FALLBACK_CLIENT: Client = {
  uid: "—",
  store: "매장 없음",
  industry: "온보딩 필요",
  tone: [],
  channels: ["ig"],
  avatar: showcase1,
  status: "pending",
  thisMonth: 0,
  plan: "Standard",
  queuedCount: 0,
};

const CHANNEL_META = {
  ig: { name: "Instagram", Icon: Instagram, color: "oklch(0.55 0.18 18)" },
  tt: { name: "TikTok", Icon: Music2, color: "oklch(0.22 0.05 265)" },
  yt: { name: "YouTube", Icon: Youtube, color: "oklch(0.55 0.22 25)" },
  nv: { name: "Naver", Icon: Globe, color: "oklch(0.55 0.16 150)" },
  kk: { name: "Kakao", Icon: MessageCircle, color: "oklch(0.78 0.16 90)" },
} as const;

const SAMPLE_TAGS = [
  ["#미나리삼겹살", "#성수맛집", "#성수동회식", "#삼겹살", "#감성식당"],
  ["#오늘의메뉴", "#성수동", "#서울맛집", "#회식추천", "#소주안주"],
  ["#삼겹살맛집", "#수요미식회", "#성수핫플", "#데이트맛집", "#회식하기좋은곳"],
  ["#한식주점", "#감성주점", "#성수동맛집추천", "#야장맛집", "#친구랑가기좋은곳"],
  ["#로이어드", "#매일새로운피드", "#사장님의일상", "#매장스토리", "#오늘의장사"],
];

const SAMPLE_BODY = `[성수동 #감성식당]

오늘도 새벽시장에서 직접 골라온 1++ 한돈,
은은한 미나리 향을 입혀 두툼하게 굽습니다.

지글지글 익어가는 소리,
한 점 들어 입에 넣는 순간,
오늘 하루의 피로가 사르르 풀려요.

🍽 오늘의 운영 16:00 — 24:00
📍 서울 성수동 골목 안쪽
📞 예약 환영`;

/* ---------------- Component ---------------- */
function AdminConsole() {
  const listStores = useServerFn(listStoresFn);
  const getCurrentUser = useServerFn(getCurrentUserFn);

  const [stores, setStores] = useState<Client[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [storesLoading, setStoresLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string }>({
    name: "크루",
    email: "",
  });

  const [selectedUid, setSelectedUid] = useState<string>("");
  const [query, setQuery] = useState("");
  const initialTab =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("tab") as
          | "workspace"
          | "queue"
          | "channels"
          | "leads"
          | "assets"
          | "members"
          | "analytics"
          | "settings"
          | null)
      : null;
  const [nav, setNav] = useState<
    "workspace" | "queue" | "channels" | "leads" | "assets" | "members" | "analytics" | "settings"
  >(initialTab && ["workspace", "queue", "channels", "leads", "assets", "members", "analytics", "settings"].includes(initialTab) ? initialTab : "workspace");

  const [workspaceReset, setWorkspaceReset] = useState(0);

  const [oauthDialogOpen, setOauthDialogOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("setup") === "oauth";
  });
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("setup") !== "oauth") return;
    setOauthDialogOpen(true);
    params.delete("setup");
    const qs = params.toString();
    window.history.replaceState({}, "", `/admin${qs ? `?${qs}` : ""}`);
  }, []);

  const loadStores = useCallback(async () => {
    setStoresLoading(true);
    try {
      const [storeRes, userRes] = await Promise.all([listStores(), getCurrentUser()]);
      setIsAdmin(storeRes.isAdmin);
      const mapped = storeRes.stores.map((s, i) => storeToClient(s, i));
      setStores(mapped);
      if (mapped.length > 0) {
        setSelectedUid((prev) => (mapped.some((c) => c.uid === prev) ? prev : mapped[0].uid));
      }
      const name =
        userRes.profile?.display_name?.trim() ||
        userRes.profile?.business_name?.trim() ||
        userRes.email.split("@")[0] ||
        "크루";
      setCurrentUser({ name, email: userRes.email });
    } catch {
      setStores([]);
    } finally {
      setStoresLoading(false);
    }
  }, [listStores, getCurrentUser]);

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

  const filtered = useMemo(
    () =>
      stores.filter(
        (c) =>
          !query ||
          c.store.toLowerCase().includes(query.toLowerCase()) ||
          c.uid.toLowerCase().includes(query.toLowerCase()),
      ),
    [stores, query],
  );
  const active = stores.find((c) => c.uid === selectedUid) ?? filtered[0] ?? FALLBACK_CLIENT;
  const queueBadge = stores.reduce((sum, s) => sum + s.queuedCount, 0);

  return (
    <div className="min-h-screen bg-secondary/50 text-foreground flex">
      <SideNav nav={nav} setNav={setNav} queueBadge={queueBadge} currentUser={currentUser} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          query={query}
          setQuery={setQuery}
          active={active}
          storeCode={active.uid !== "—" ? active.uid : undefined}
          onBulkGenerate={() => setBulkDialogOpen(true)}
          onNewContent={() => {
            setNav("workspace");
            setWorkspaceReset((n) => n + 1);
          }}
        />
        <SetupBanner onOpenSettings={() => setNav("settings")} />
        <PanelErrorBoundary key={nav} label="이 화면">
        {storesLoading && nav === "workspace" ? (
          <div className="flex-1 grid place-items-center text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin inline mr-2" />
            매장 목록 로딩 중…
          </div>
        ) : nav === "leads" ? (
          <LeadsPanel
            storeCode={active.uid !== "—" ? active.uid : undefined}
            storeName={active.store}
          />
        ) : nav === "assets" ? (
          <AssetsPanel />
        ) : nav === "channels" ? (
          <SocialPublishPanel
            storeCode={active.uid !== "—" ? active.uid : undefined}
            storeName={active.store}
            industry={active.industry}
            onRequestOAuthSetup={() => setOauthDialogOpen(true)}
          />
        ) : nav === "queue" ? (
          <QueuePanel storeCode={active.uid !== "—" ? active.uid : undefined} storeName={active.store} />
        ) : nav === "members" ? (
          <MembersPanel storeCode={active.uid !== "—" ? active.uid : undefined} isAdmin={isAdmin} />
        ) : nav === "analytics" ? (
          <AnalyticsPanel storeCode={active.uid !== "—" ? active.uid : undefined} storeName={active.store} />
        ) : nav === "settings" ? (
          <PlatformSetupWizard storeCode={active.uid !== "—" ? active.uid : undefined} />
        ) : stores.length === 0 ? (
          <div className="flex-1 grid place-items-center p-8 text-center">
            <div className="max-w-md space-y-3">
              <h2 className="font-display text-xl font-bold">등록된 매장이 없습니다</h2>
              <p className="text-sm text-muted-foreground">
                온보딩을 완료하거나 관리자에게 매장 코드 할당을 요청하세요.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex min-h-0">
            <ClientList
              clients={filtered}
              selectedUid={selectedUid}
              onSelect={setSelectedUid}
              onRefresh={() => void loadStores()}
              loading={storesLoading}
            />
            <Workspace client={active} resetSignal={workspaceReset} />
            <AiPanel
              client={active}
              storeCode={active.uid !== "—" ? active.uid : undefined}
              onConnectChannels={() => setOauthDialogOpen(true)}
            />
          </div>
        )}
        </PanelErrorBoundary>
      </div>
      <ChannelOAuthConnectDialog
        open={oauthDialogOpen}
        onOpenChange={setOauthDialogOpen}
        onConnected={() => void setNav("channels")}
        storeCode={active.uid !== "—" ? active.uid : undefined}
      />
      <BulkGenerateDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        storeCode={active.uid !== "—" ? active.uid : undefined}
        storeName={active.store}
        industry={active.industry}
        tone={active.tone}
        onEnqueued={() => {
          void loadStores();
          setNav("queue");
        }}
      />
    </div>
  );
}

/* ---------------- Side nav ---------------- */
function SideNav({
  nav,
  setNav,
  queueBadge,
  currentUser,
}: {
  nav: string;
  setNav: (n: any) => void;
  queueBadge: number;
  currentUser: { name: string; email: string };
}) {
  const items = [
    { id: "workspace", label: "워크스페이스", Icon: LayoutDashboard },
    { id: "queue", label: "생성 큐", Icon: Layers, badge: queueBadge > 0 ? queueBadge : undefined },
    { id: "channels", label: "채널 세션", Icon: ShieldCheck },
    { id: "assets", label: "소재함", Icon: FolderOpen },
    { id: "leads", label: "상담 리드", Icon: Bell },
    { id: "members", label: "회원 관리", Icon: Users },
    { id: "analytics", label: "성과 리포트", Icon: Activity },
    { id: "settings", label: "설정 & API", Icon: Settings },
  ];
  return (
    <aside className="w-[240px] shrink-0 bg-card border-r border-border flex flex-col">
      <div className="px-5 py-5 border-b border-border flex items-center gap-2.5">
        <img src={logo} alt="로이어드" className="size-9 rounded-xl ring-1 ring-primary/15 shadow-soft" />
        <div className="leading-tight">
          <div className="font-display font-bold text-sm">로이어드</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Admin Console</div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {items.map((it) => {
          const activeNav = nav === it.id;
          return (
            <button
              key={it.id}
              onClick={() => {
                setNav(it.id);
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  if (it.id === "workspace") url.searchParams.delete("tab");
                  else url.searchParams.set("tab", it.id);
                  window.history.replaceState({}, "", url.pathname + url.search);
                }
              }}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                activeNav
                  ? "bg-brand text-primary-foreground shadow-soft"
                  : "text-foreground/70 hover:bg-secondary hover:text-foreground"
              }`}
            >
              <it.Icon className="size-4" />
              <span className="flex-1 text-left">{it.label}</span>
              {it.badge && (
                <span
                  className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${
                    activeNav ? "bg-white/20 text-white" : "bg-accent-gradient text-accent-foreground"
                  }`}
                >
                  {it.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <Link
          to="/"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition"
        >
          <ArrowLeft className="size-3.5" />
          홍보 사이트로 이동
        </Link>
        <div className="mt-3 p-3 rounded-2xl bg-secondary border border-border">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-brand text-primary-foreground grid place-items-center text-xs font-bold">
              {currentUser.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate">{currentUser.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{currentUser.email || "—"}</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ---------------- Top bar ---------------- */
function TopBar({
  query,
  setQuery,
  active,
  storeCode,
  onBulkGenerate,
  onNewContent,
}: {
  query: string;
  setQuery: (v: string) => void;
  active: Client;
  storeCode?: string;
  onBulkGenerate?: () => void;
  onNewContent?: () => void;
}) {
  return (
    <header className="h-16 shrink-0 bg-card border-b border-border flex items-center gap-4 px-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Crew Console</span>
        <ChevronRight className="size-3" />
        <span className="text-foreground font-medium">{active.store}</span>
        <span className="text-muted-foreground/70 font-mono">#{active.uid}</span>
      </div>

      <div className="ml-auto flex items-center gap-3 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="UID 또는 점포명 검색 (예: #ZA-2026-0917)"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-secondary border border-border text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
          />
        </div>
      </div>

      <JobNotificationsBell storeCode={storeCode} />
      <button
        type="button"
        onClick={onNewContent}
        className="hidden md:inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-border bg-secondary text-sm font-semibold hover:bg-secondary/80 transition"
      >
        <Plus className="size-4" />
        새 콘텐츠
      </button>
      <button
        type="button"
        onClick={onBulkGenerate}
        className="hidden md:inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-brand text-primary-foreground text-sm font-semibold shadow-navy hover:opacity-90 transition"
      >
        <Sparkles className="size-4" />
        AI 대량 생성
      </button>
      <button
        onClick={() => void supabase.auth.signOut().then(() => { window.location.href = "/"; })}
        className="hidden sm:inline-flex items-center h-10 px-3 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition"
      >
        로그아웃
      </button>
    </header>
  );
}

/* ---------------- Client list ---------------- */
function ClientList({
  clients,
  selectedUid,
  onSelect,
  onRefresh,
  loading,
}: {
  clients: Client[];
  selectedUid: string;
  onSelect: (uid: string) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="w-[300px] shrink-0 bg-card border-r border-border flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">담당 회원</div>
          <div className="text-sm font-semibold mt-0.5">{clients.length}개 워크스페이스</div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="size-8 grid place-items-center rounded-lg hover:bg-secondary transition"
        >
          <RefreshCw className={`size-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {clients.map((c) => {
          const isActive = c.uid === selectedUid;
          return (
            <button
              key={c.uid}
              onClick={() => onSelect(c.uid)}
              className={`w-full text-left p-3 rounded-2xl border transition flex gap-3 ${
                isActive
                  ? "bg-primary/[0.05] border-primary/30 shadow-soft"
                  : "border-transparent hover:bg-secondary"
              }`}
            >
              <img src={c.avatar} alt="" className="size-12 rounded-xl object-cover shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold truncate">{c.store}</div>
                  <StatusDot status={c.status} />
                </div>
                <div className="text-[11px] font-mono text-muted-foreground mt-0.5">#{c.uid}</div>
                <div className="text-[11px] text-muted-foreground mt-1 truncate">{c.industry}</div>
                <div className="mt-2 flex items-center gap-1.5">
                  {c.channels.map((ch) => {
                    const M = CHANNEL_META[ch];
                    return (
                      <div key={ch} className="size-5 rounded-md bg-secondary grid place-items-center" title={M.name}>
                        <M.Icon className="size-3 text-foreground/70" />
                      </div>
                    );
                  })}
                  <span className="ml-auto text-[10px] text-muted-foreground">{c.thisMonth}건/월</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: Client["status"] }) {
  const cfg = {
    active: { color: "bg-emerald-500", label: "정상" },
    pending: { color: "bg-amber-500", label: "대기" },
    "needs-auth": { color: "bg-accent", label: "재인증 필요" },
  }[status];
  return <span className={`size-1.5 rounded-full ${cfg.color}`} title={cfg.label} />;
}

/* ---------------- Workspace (center) ---------------- */
function Workspace({ client, resetSignal = 0 }: { client: Client; resetSignal?: number }) {
  const listDraftsFn = useServerFn(listDrafts);
  const [tab, setTab] = useState<"text" | "image" | "video" | "blog" | "media" | "schedule">(
    "text",
  );
  const [body, setBody] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [keyword, setKeyword] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [publishPlatform, setPublishPlatform] = useState<SocialPlatform>("instagram");
  const storeCode = client.uid !== "—" ? client.uid : undefined;

  const loadLatestDraft = useCallback(async () => {
    if (!storeCode) {
      setBody("");
      setHashtags([]);
      setImageUrl(null);
      setVideoUrl("");
      setKeyword("");
      return;
    }
    try {
      const drafts = await listDraftsFn({ data: { storeCode } });
      const latest = drafts[0];
      if (latest) {
        setBody(latest.body);
        setHashtags(Array.isArray(latest.hashtags) ? latest.hashtags : []);
        setImageUrl(latest.image_urls?.[0] ?? null);
        setKeyword(latest.title?.trim() || client.store);
      } else {
        setBody("");
        setHashtags([]);
        setImageUrl(null);
        setKeyword(client.store);
      }
    } catch {
      setKeyword(client.store);
    }
  }, [client.store, listDraftsFn, storeCode]);

  useEffect(() => {
    if (resetSignal > 0) {
      setBody("");
      setHashtags([]);
      setImageUrl(null);
      setVideoUrl("");
      setKeyword(client.store);
      setTab("text");
      toast.success("새 콘텐츠 작성을 시작합니다.");
      return;
    }
    void loadLatestDraft();
  }, [client.uid, resetSignal, loadLatestDraft, client.store]);

  return (
    <main className="flex-1 min-w-0 overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-border bg-card">
        <div className="flex items-start gap-4">
          <img src={client.avatar} alt="" className="size-16 rounded-2xl object-cover shadow-soft" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold">{client.store}</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-gradient text-accent-foreground uppercase tracking-wider">
                {client.plan}
              </span>
            </div>
            <div className="text-xs font-mono text-muted-foreground mt-1">#{client.uid}</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-[11px] px-2 py-1 rounded-md bg-secondary border border-border">{client.industry}</span>
              {client.tone.map((t) => (
                <span key={t} className="text-[11px] px-2 py-1 rounded-md bg-primary/[0.06] border border-primary/20 text-primary">
                  #{t}
                </span>
              ))}
            </div>
          </div>
          <div className="hidden md:grid grid-cols-3 gap-3 text-center">
            <Stat label="이번 달" value={client.thisMonth} suffix="건" />
            <Stat label="대기 큐" value={client.queuedCount} suffix="건" />
            <Stat label="플랜" value={client.plan} />
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex items-center gap-1 bg-secondary p-1 rounded-xl w-fit">
          {[
            { id: "text", label: "본문 + 해시태그", Icon: Type },
            { id: "image", label: "이미지", Icon: ImageIcon },
            { id: "video", label: "릴스 / 영상", Icon: Film },
            { id: "blog", label: "블로그 자동작성", Icon: PenLine },
            { id: "media", label: "미디어 스튜디오", Icon: Wand2 },
            { id: "schedule", label: "스케줄", Icon: Calendar },
          ].map((t) => {
            const isOn = tab === (t.id as any);
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition ${
                  isOn ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.Icon className="size-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5">
        {tab === "text" && (
          <TextTab
            body={body}
            setBody={setBody}
            keyword={keyword}
            setKeyword={setKeyword}
            client={client}
            onHashtags={setHashtags}
            onModel={setAiModel}
          />
        )}
        {tab === "image" && (
          <ImageTab client={client} keyword={keyword} imageUrl={imageUrl} setImageUrl={setImageUrl} />
        )}
        {tab === "video" && (
          <VideoTab
            client={client}
            body={body}
            keyword={keyword}
            videoUrl={videoUrl}
            onVideoUrlChange={setVideoUrl}
            onCaptionChange={setBody}
            onPlatformChange={setPublishPlatform}
          />
        )}
        {tab === "blog" && (
          <BlogComposerPanel
            storeCode={storeCode}
            storeName={client.store}
            defaultKeyword={keyword}
          />
        )}
        {tab === "media" && <MediaStudioPanel storeCode={storeCode} />}
        {tab === "schedule" && (
          <ScheduleTab
            client={client}
            storeCode={storeCode}
            body={body}
            hashtags={hashtags}
            imageUrl={imageUrl}
            aiModel={aiModel}
          />
        )}

        <PublishBar
          client={client}
          storeCode={storeCode}
          body={body}
          hashtags={hashtags}
          imageUrl={imageUrl}
          videoUrl={videoUrl}
          aiModel={aiModel}
          platform={publishPlatform}
          onPlatformChange={setPublishPlatform}
        />
      </div>
    </main>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="px-4 py-2 rounded-xl bg-secondary border border-border min-w-[88px]">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display font-bold text-lg leading-tight">
        {value}
        {suffix && <span className="text-xs font-medium text-muted-foreground ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}

/* ----- Text tab ----- */
function TextTab({
  body,
  setBody,
  keyword,
  setKeyword,
  client,
  onHashtags,
  onModel,
}: {
  body: string;
  setBody: (v: string) => void;
  keyword: string;
  setKeyword: (v: string) => void;
  client: Client;
  onHashtags?: (tags: string[]) => void;
  onModel?: (m: string | null) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [tagSetIdx, setTagSetIdx] = useState(0);
  const [aiTags, setAiTags] = useState<string[] | null>(null);
  const [aiError, setAiError] = useState<string>("");
  const generate = useServerFn(generateContent);

  async function regen() {
    setGenerating(true);
    setAiError("");
    try {
      const res = await generate({
        data: {
          store: client.store,
          industry: client.industry,
          tone: client.tone,
          keyword,
          channel: "instagram",
        },
      });
      if (res.body) setBody(res.body);
      if (res.hashtags?.length) {
        setAiTags(res.hashtags);
        onHashtags?.(res.hashtags);
      }
      onModel?.(res.model ?? null);
    } catch (e) {
      setAiError("AI 생성에 실패했습니다. LOVABLE_API_KEY와 네트워크를 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setGenerating(false);
    }
  }

  const toneScore = useMemo(
    () => computeToneMatchScore(body, client.industry, client.tone),
    [body, client.industry, client.tone]
  );
  const toneLabel = client.tone.length ? client.tone.join(" · ") : "감성적 · 신뢰감";

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(body);
      toast.success("본문이 클립보드에 복사되었습니다.");
    } catch {
      toast.error("클립보드 복사에 실패했습니다.");
    }
  }

  return (
    <div className="grid lg:grid-cols-5 gap-5">
      <div className="lg:col-span-3 rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Type className="size-4 text-primary" /> 본문 에디터
          </div>
          <button
            onClick={regen}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-primary-foreground text-xs font-semibold shadow-soft hover:opacity-90 transition disabled:opacity-60"
          >
            {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
            {generating ? "생성 중…" : "AI 다시 생성"}
          </button>
        </div>

        {aiError && (
          <div className="mb-3 p-2.5 rounded-lg bg-accent/10 border border-accent/30 text-[11px] text-accent flex items-center gap-1.5">
            <AlertCircle className="size-3" /> {aiError}
          </div>
        )}

        <label className="text-[11px] uppercase tracking-widest text-muted-foreground">핵심 키워드</label>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="예: 오늘의 메뉴, 신메뉴 출시, 주말 한정"
          className="mt-1 w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
        />

        <label className="block mt-4 text-[11px] uppercase tracking-widest text-muted-foreground">본문</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          className="mt-1 w-full p-3 rounded-xl bg-secondary border border-border text-sm leading-relaxed font-sans focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 resize-none"
        />
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{body.length} / 2200자</span>
          <button
            type="button"
            onClick={() => void copyBody()}
            disabled={!body.trim()}
            className="inline-flex items-center gap-1 hover:text-foreground transition disabled:opacity-40"
          >
            <Copy className="size-3" /> 클립보드 복사
          </button>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-5">
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Hash className="size-4 text-crimson" /> {aiTags ? "AI 추천 해시태그" : "해시태그 5조합"}
            </div>
            <button
              onClick={() => {
                setAiTags(null);
                setTagSetIdx((i) => (i + 1) % SAMPLE_TAGS.length);
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition"
            >
              <RefreshCw className="size-3" /> 샘플
            </button>
          </div>
          {aiTags ? (
            <div className="rounded-xl border border-primary/30 bg-primary/[0.05] p-3 flex flex-wrap gap-1.5">
              {aiTags.map((t) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-card border border-border text-foreground/80">
                  {t}
                </span>
              ))}
            </div>
          ) : (
          <div className="space-y-2">
            {SAMPLE_TAGS.map((set, i) => (
              <div
                key={i}
                className={`rounded-xl border p-2.5 cursor-pointer transition ${
                  i === tagSetIdx ? "bg-primary/[0.05] border-primary/30" : "bg-secondary border-border hover:bg-secondary/70"
                }`}
                onClick={() => setTagSetIdx(i)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">조합 {i + 1}</span>
                  {i === tagSetIdx && <Check className="size-3 text-primary" />}
                </div>
                <div className="flex flex-wrap gap-1">
                  {set.map((t) => (
                    <span key={t} className="text-[11px] text-foreground/80">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        <div className="rounded-2xl bg-brand text-primary-foreground p-5 shadow-navy">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/70">
            <Bot className="size-3.5" /> AI 톤 분석
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/90">
            본문 톤이 <strong className="text-white">{toneLabel}</strong> 가이드라인과{" "}
            <strong className="text-white">{toneScore}%</strong> 일치합니다 ({describeToneMatch(toneScore)}).
            {toneScore >= 70 && body.includes("지글") && " 의성어가 몰입도를 높였습니다."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ----- Image tab ----- */
function ImageTab({
  client,
  keyword,
  imageUrl,
  setImageUrl,
}: {
  client: Client;
  keyword: string;
  imageUrl: string | null;
  setImageUrl: (u: string | null) => void;
}) {
  const styles = [
    { id: "moody", label: "감성 식당", hint: "warm moody lighting, cinematic restaurant photography" },
    { id: "studio", label: "스튜디오 컷", hint: "clean studio product photo, soft shadows, minimalist" },
    { id: "lifestyle", label: "라이프스타일", hint: "lifestyle editorial photo, natural light, candid moment" },
  ];
  const [picked, setPicked] = useState("moody");
  const [generating, setGenerating] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setErr(null);
    setFinalized(false);
    setImageUrl(null);
    const style = styles.find((s) => s.id === picked)?.hint ?? "";
    const prompt = `${style}. Subject: ${client.store} (${client.industry}). Topic: ${keyword}. Korean small-business SNS feed image, 4:5 portrait composition, mouthwatering, high detail, no text overlays.`;
    try {
      await streamImage("/api/generate-image", prompt, (dataUrl, isFinal) => {
        setImageUrl(dataUrl);
        if (isFinal) setFinalized(true);
      });
      setFinalized(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "이미지 생성 실패");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-5 gap-5">
      <div className="lg:col-span-3 rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ImageIcon className="size-4 text-primary" /> AI 미디어 생성
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-primary-foreground text-xs font-semibold shadow-soft hover:opacity-90 transition disabled:opacity-60"
          >
            {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
            {generating ? "생성 중…" : imageUrl ? "다시 생성" : "AI 이미지 생성"}
          </button>
        </div>
        <div className="relative rounded-2xl overflow-hidden border border-border aspect-[4/5] bg-secondary">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="AI 생성 미디어"
              className={`w-full h-full object-cover transition-[filter] duration-500 ${finalized ? "blur-0" : "blur-2xl"}`}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground p-6 text-center">
              {generating ? "AI가 매장 컨셉으로 이미지를 만들고 있어요…" : "스타일을 선택하고 AI 이미지 생성을 눌러 보세요."}
            </div>
          )}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-card/90 backdrop-blur rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-soft">
            <img src={logo} className="size-4 rounded-md" alt="" /> 로이어드 워터마크
          </div>
          {imageUrl && (
            <div className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-black/70 to-transparent text-white">
              <div className="text-[11px] uppercase tracking-widest opacity-80">{keyword}</div>
              <div className="font-display text-xl font-bold leading-tight mt-0.5">{client.store}</div>
            </div>
          )}
        </div>
        {err && (
          <div className="mt-3 p-2.5 rounded-lg bg-accent/10 border border-accent/30 text-[11px] text-accent flex items-center gap-1.5">
            <AlertCircle className="size-3" /> {err}
          </div>
        )}
      </div>

      <div className="lg:col-span-2 space-y-5">
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="text-sm font-semibold mb-3">스타일 프리셋</div>
          <div className="grid grid-cols-3 gap-2">
            {styles.map((s) => (
              <button
                key={s.id}
                onClick={() => setPicked(s.id)}
                className={`aspect-square rounded-xl border-2 p-2 text-center transition flex flex-col items-center justify-center gap-1 ${
                  picked === s.id ? "border-primary bg-primary/[0.05]" : "border-border hover:border-primary/40"
                }`}
              >
                <Sparkles className={`size-4 ${picked === s.id ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-[10px] font-medium">{s.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            현재 키워드 <span className="font-semibold text-foreground">"{keyword}"</span> 기준으로 매장 컨셉에 맞춰 생성합니다.
          </p>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Layers className="size-4 text-crimson" /> 레이어
          </div>
          <div className="space-y-2 text-sm">
            {[
              { name: "AI 배경 이미지", visible: !!imageUrl },
              { name: "로고 워터마크", visible: true },
              { name: "헤드라인 텍스트", visible: !!imageUrl },
            ].map((l) => (
              <div key={l.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary border border-border">
                <span className={l.visible ? "" : "text-muted-foreground line-through"}>{l.name}</span>
                <span className={`size-2 rounded-full ${l.visible ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----- Video tab ----- */
function VideoTab({
  client,
  body,
  keyword,
  videoUrl,
  onVideoUrlChange,
  onCaptionChange,
  onPlatformChange,
}: {
  client: Client;
  body: string;
  keyword: string;
  videoUrl: string;
  onVideoUrlChange: (v: string) => void;
  onCaptionChange: (v: string) => void;
  onPlatformChange: (p: SocialPlatform) => void;
}) {
  const [target, setTarget] = useState<"tiktok" | "youtube">("tiktok");
  const [generating, setGenerating] = useState(false);
  const [storyboard, setStoryboard] = useState<{
    hook: string;
    scenes: { durationSec: number; visual: string; onScreenText: string }[];
    note: string;
  } | null>(null);
  const generateStoryboard = useServerFn(generateVideoStoryboard);

  useEffect(() => {
    onPlatformChange(target === "tiktok" ? "tiktok" : "youtube");
  }, [target, onPlatformChange]);

  const platform = target === "tiktok" ? "tiktok" : "youtube";

  async function handleGenerateStoryboard() {
    setGenerating(true);
    try {
      const res = await generateStoryboard({
        data: {
          store: client.store,
          industry: client.industry,
          keyword: keyword || client.store,
          caption: body,
          platform: target,
        },
      });
      setStoryboard({ hook: res.hook, scenes: res.scenes, note: res.note });
      if (res.caption?.trim()) onCaptionChange(res.caption);
      toast.success("AI 스토리보드가 생성되었습니다.");
    } catch {
      toast.error("스토리보드 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-5 gap-5">
      <div className="lg:col-span-3 rounded-2xl bg-card border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Film className="size-4 text-primary" /> 릴스 / 쇼츠 발행 준비
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleGenerateStoryboard()}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-primary-foreground text-xs font-semibold disabled:opacity-60"
            >
              {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
              AI 스토리보드
            </button>
            <div className="flex gap-1 p-1 rounded-lg bg-secondary border border-border">
            <button
              type="button"
              onClick={() => setTarget("tiktok")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                target === "tiktok" ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              TikTok
            </button>
            <button
              type="button"
              onClick={() => setTarget("youtube")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                target === "youtube" ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              YouTube Shorts
            </button>
          </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-secondary aspect-[9/16] max-h-[420px] grid place-items-center overflow-hidden">
          {videoUrl.trim() ? (
            <video src={videoUrl.trim()} controls className="w-full h-full object-cover" />
          ) : (
            <div className="text-center p-6 text-xs text-muted-foreground space-y-2">
              <Film className="size-8 mx-auto opacity-50" />
              <p>동영상 URL을 입력하면 미리보기가 표시됩니다.</p>
              <p className="text-[10px]">mp4 · mov · webm 권장</p>
            </div>
          )}
        </div>

        <label className="block text-xs font-semibold text-muted-foreground">동영상 URL</label>
        <input
          value={videoUrl}
          onChange={(e) => onVideoUrlChange(e.target.value)}
          placeholder="https://storage.example.com/reel.mp4"
          className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm font-mono"
        />
        <p className="text-[11px] text-muted-foreground">{PLATFORM_HINT[platform]}</p>
      </div>

      <div className="lg:col-span-2 space-y-5">
        {storyboard && (
          <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
            <div className="text-sm font-semibold">AI 스토리보드</div>
            <p className="text-xs font-medium text-primary">{storyboard.hook}</p>
            <ol className="space-y-2 text-xs text-muted-foreground">
              {storyboard.scenes.map((s, i) => (
                <li key={i} className="rounded-lg bg-secondary p-2 border border-border">
                  <span className="font-mono text-[10px] text-foreground">{s.durationSec}s</span> — {s.visual}
                  {s.onScreenText ? ` · "${s.onScreenText}"` : ""}
                </li>
              ))}
            </ol>
            <p className="text-[10px] text-muted-foreground">{storyboard.note}</p>
          </div>
        )}
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="text-sm font-semibold mb-2">{client.store}</div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            AI 스토리보드로 촬영 가이드를 받은 뒤 mp4 URL을 입력하고, 본문 탭 캡션과 함께 하단 발행 바에서{" "}
            {SOCIAL_PLATFORM_LABELS[platform]}로 게시할 수 있습니다.
          </p>
        </div>
        <div className="rounded-2xl bg-brand text-primary-foreground p-5">
          <div className="text-xs font-semibold uppercase tracking-widest text-white/70">체크리스트</div>
          <ul className="mt-3 space-y-2 text-sm text-white/90">
            <li className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0" /> 세로 9:16 · 15–60초 권장
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0" /> 채널 세션에서 {SOCIAL_PLATFORM_LABELS[platform]} OAuth 연결
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0" /> 공개 가능한 HTTPS 동영상 URL
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ----- Schedule tab ----- */
function ScheduleTab({
  client,
  storeCode,
  body,
  hashtags,
  imageUrl,
  aiModel,
}: {
  client: Client;
  storeCode?: string;
  body: string;
  hashtags: string[];
  imageUrl: string | null;
  aiModel: string | null;
}) {
  const days = ["월", "화", "수", "목", "금", "토", "일"];
  const slots = [9, 12, 15, 18, 21];
  const save = useServerFn(saveDraft);
  const sched = useServerFn(scheduleDraft);
  const list = useServerFn(listSchedule);
  const unsched = useServerFn(unscheduleSlot);

  const weekStart = useMemo(() => {
    const d = new Date();
    const dow = (d.getDay() + 6) % 7; // Mon=0
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - dow);
    return d;
  }, []);

  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function refresh() {
    try {
      const to = new Date(weekStart);
      to.setDate(to.getDate() + 7);
      const data = await list({ data: { from: weekStart.toISOString(), to: to.toISOString(), storeCode } });
      setRows(data);
    } catch (e) {
      // ignore — empty state is fine
    }
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.getTime(), storeCode]);

  function slotAt(dayIdx: number, hour: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dayIdx);
    d.setHours(hour, 0, 0, 0);
    return d;
  }
  function findRow(dayIdx: number, hour: number) {
    const target = slotAt(dayIdx, hour).getTime();
    return rows.find((r) => new Date(r.scheduled_at).getTime() === target);
  }

  async function toggleSlot(dayIdx: number, hour: number) {
    const key = `${dayIdx}-${hour}`;
    const existing = findRow(dayIdx, hour);
    setBusyKey(key);
    try {
      if (existing) {
        await unsched({ data: { id: existing.id } });
        toast.success("예약을 취소했어요.");
      } else {
        if (!body || body.length < 5) {
          toast.error("본문을 먼저 작성해 주세요.");
          return;
        }
        const draft = await save({
          data: {
            storeCode,
            title: `${client.store} · ${slotAt(dayIdx, hour).toLocaleDateString("ko-KR")}`,
            body,
            hashtags,
            imageUrls: imageUrl ? [imageUrl] : [],
            channel: "instagram",
            aiModel,
          },
        });
        await sched({
          data: {
            storeCode,
            draftId: draft.id,
            channel: "instagram",
            scheduledAt: slotAt(dayIdx, hour).toISOString(),
          },
        });
        toast.success(`${days[dayIdx]} ${hour}:00 예약 완료`);
      }
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "예약 처리 실패");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="size-4 text-primary" /> {client.store} 이번 주 발행 스케줄
        </div>
        <div className="text-[11px] text-muted-foreground">
          슬롯을 클릭하면 현재 본문/해시태그/이미지를 그 시간에 예약합니다.
        </div>
      </div>
      <div className="grid grid-cols-[60px_1fr] gap-2">
        <div />
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-muted-foreground">
          {days.map((d, i) => {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            return (
              <div key={d}>
                {d}
                <div className="text-[10px] font-normal text-muted-foreground/70">{date.getDate()}일</div>
              </div>
            );
          })}
        </div>
        {slots.map((s) => (
          <Fragment key={s}>
            <div className="text-xs text-muted-foreground self-center">{s}:00</div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((d, dayIdx) => {
                const row = findRow(dayIdx, s);
                const key = `${dayIdx}-${s}`;
                const isBusy = busyKey === key;
                return (
                  <button
                    key={d}
                    onClick={() => void toggleSlot(dayIdx, s)}
                    disabled={isBusy}
                    className={`h-10 rounded-lg border transition grid place-items-center ${
                      row
                        ? "bg-primary/[0.10] border-primary/40 hover:bg-primary/[0.15]"
                        : "bg-secondary border-border border-dashed hover:border-primary/30 hover:bg-primary/[0.04]"
                    } disabled:opacity-50`}
                    title={row ? "클릭하여 예약 취소" : "클릭하여 예약"}
                  >
                    {isBusy ? (
                      <Loader2 className="size-3.5 animate-spin text-primary" />
                    ) : row ? (
                      <Instagram className="size-3.5 text-primary" />
                    ) : (
                      <Plus className="size-3 text-muted-foreground/40" />
                    )}
                  </button>
                );
              })}
            </div>
          </Fragment>
        ))}
      </div>
      <div className="mt-4 text-[11px] text-muted-foreground">
        예약 {rows.length}건 등록됨 · 매장 코드 기준으로 격리되어 저장됩니다.
      </div>
    </div>
  );
}

/* ----- Publish bar ----- */
function PublishBar({
  client,
  storeCode,
  body,
  hashtags,
  imageUrl,
  videoUrl,
  aiModel,
  platform,
  onPlatformChange,
}: {
  client: Client;
  storeCode?: string;
  body: string;
  hashtags: string[];
  imageUrl: string | null;
  videoUrl: string;
  aiModel: string | null;
  platform: SocialPlatform;
  onPlatformChange: (p: SocialPlatform) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [drivePath, setDrivePath] = useState(`/${client.uid}_${client.store}/`);
  const save = useServerFn(saveDraft);
  const getDrivePath = useServerFn(getStoreDrivePathFn);
  const createPost = useServerFn(createSocialPostFn);
  const publishPost = useServerFn(publishSocialPostFn);
  const { isConnected } = useSocialAccounts(storeCode);

  useEffect(() => {
    if (!storeCode) return;
    void getDrivePath({ data: { storeCode } })
      .then((r: { path: string }) => setDrivePath(r.path))
      .catch(() => setDrivePath(`/${client.uid}_${client.store}/`));
  }, [storeCode, client.uid, client.store, getDrivePath]);

  function buildCaption() {
    const tagLine = hashtags.length
      ? "\n\n" + hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")
      : "";
    return (body.trim() + tagLine).trim();
  }

  async function onSave() {
    if (!body || body.length < 5) {
      toast.error("본문을 먼저 작성해 주세요.");
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          storeCode,
          title: `${client.store} · ${new Date().toLocaleString("ko-KR")}`,
          body,
          hashtags,
          imageUrls: imageUrl ? [imageUrl] : [],
          channel: "instagram",
          aiModel,
        },
      });
      setSaved(true);
      toast.success("드래프트를 저장했어요.");
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function onPublish() {
    const caption = buildCaption();
    if (!caption || caption.length < 5) {
      toast.error("본문을 먼저 작성해 주세요.");
      return;
    }
    if (!isConnected(platform)) {
      toast.error(`${SOCIAL_PLATFORM_LABELS[platform]} 계정을 먼저 연결하세요. (채널 세션 탭)`);
      return;
    }
    setPublishing(true);
    try {
      const mediaUrls = videoUrl.trim()
        ? [videoUrl.trim()]
        : imageUrl?.trim()
          ? [imageUrl.trim()]
          : [];
      const { post } = await createPost({
        data: {
          storeCode,
          platform,
          caption,
          mediaUrls,
        },
      });
      await publishPost({ data: { postId: post.id, storeCode } });
      setPublished(true);
      toast.success(`${SOCIAL_PLATFORM_LABELS[platform]} 발행 완료!`);
      setTimeout(() => setPublished(false), 2200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "발행 실패");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 bg-card/95 backdrop-blur border-t border-border flex flex-wrap items-center gap-3">
      <div className="text-xs text-muted-foreground mr-auto flex flex-wrap items-center gap-2">
        <span>
          구글드라이브: <span className="font-mono text-foreground/80">{drivePath}</span>
        </span>
        <select
          value={platform}
          onChange={(e) => onPlatformChange(e.target.value as SocialPlatform)}
          className="h-8 px-2 rounded-lg bg-secondary border border-border text-xs"
        >
          {ALL_SOCIAL_PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {SOCIAL_PLATFORM_LABELS[p]}
              {isConnected(p) ? " ✓" : ""}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={() => void onSave()}
        disabled={saving}
        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-secondary border border-border text-sm font-medium hover:bg-secondary/70 transition disabled:opacity-60"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Cloud className="size-4" />}
        {saving ? "저장 중…" : saved ? "드래프트 저장됨" : "드래프트 저장"}
      </button>
      <button
        onClick={() => void onPublish()}
        disabled={publishing || !isConnected(platform)}
        className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-accent-gradient text-accent-foreground text-sm font-bold shadow-crimson hover:scale-[1.02] transition disabled:opacity-50"
      >
        {publishing ? <Loader2 className="size-4 animate-spin" /> : published ? <CheckCircle2 className="size-4" /> : <Send className="size-4" />}
        {publishing ? "발행 중…" : published ? "발행 완료" : `${SOCIAL_PLATFORM_LABELS[platform]} 발행`}
      </button>
    </div>
  );
}

/* ---------------- Right AI panel ---------------- */
const SOCIAL_PLATFORM_ICONS: Record<SocialPlatform, typeof Instagram> = {
  instagram: Instagram,
  threads: MessageCircle,
  youtube: Youtube,
  naver_blog: Globe,
  tiktok: Music2,
  kakao: MessageCircle,
};

function AiPanel({
  client,
  storeCode,
  onConnectChannels,
}: {
  client: Client;
  storeCode?: string;
  onConnectChannels: () => void;
}) {
  const { accounts, isConnected, loading: accountsLoading } = useSocialAccounts(storeCode);
  const listQueue = useServerFn(listQueueFn);
  const listActivity = useServerFn(listActivityFn);

  const [queueItems, setQueueItems] = useState<Array<{ title: string; status: string }>>([]);
  const [activities, setActivities] = useState<
    Array<{ action: string; resourceType: string; createdAt: string }>
  >([]);

  const hasDisconnected = ALL_SOCIAL_PLATFORMS.some((p) => !isConnected(p));

  useEffect(() => {
    if (!storeCode) return;
    void listQueue({ data: { storeCode } }).then((r: { items: Array<{ title: string; status: string }> }) => {
      setQueueItems(
        r.items.slice(0, 4).map((i) => ({
          title: i.title,
          status:
            i.status === "publishing"
              ? "running"
              : i.status === "queued" || i.status === "scheduled"
                ? "queued"
                : i.status === "published"
                  ? "done"
                  : "queued",
        }))
      );
    });
    void listActivity({ data: { storeCode, limit: 5 } }).then(
      (r: { activities: Array<{ action: string; resourceType: string; createdAt: string }> }) => {
        setActivities(r.activities);
      }
    );
  }, [storeCode, listQueue, listActivity]);

  return (
    <aside className="w-[340px] shrink-0 bg-card border-l border-border flex flex-col">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <div className="size-8 rounded-xl bg-accent-gradient grid place-items-center shadow-crimson">
          <Sparkles className="size-4 text-accent-foreground" />
        </div>
        <div>
          <div className="text-sm font-semibold">AI 보조 패널</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Loyard Copilot</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Channels */}
        <Card title="채널 세션 상태" icon={<ShieldCheck className="size-4 text-primary" />}>
          <div className="space-y-2">
            {accountsLoading ? (
              <div className="text-xs text-muted-foreground px-3 py-2">연결 상태 확인 중…</div>
            ) : (
              ALL_SOCIAL_PLATFORMS.map((p) => {
                const Icon = SOCIAL_PLATFORM_ICONS[p];
                const acc = accounts.find((a) => a.platform === p);
                const connected = isConnected(p);
                return (
                  <div key={p} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-border">
                    <div className="size-7 rounded-md bg-card grid place-items-center">
                      <Icon className="size-3.5 text-foreground/70" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium">{SOCIAL_PLATFORM_LABELS[p]}</span>
                      {acc && (
                        <div className="text-[10px] text-muted-foreground truncate">{acc.displayName}</div>
                      )}
                    </div>
                    {connected ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                        <Check className="size-3" /> 연결됨
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent">
                        <AlertCircle className="size-3" /> 미연결
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {!accountsLoading && hasDisconnected && (
            <button
              type="button"
              onClick={onConnectChannels}
              className="mt-3 w-full h-9 rounded-lg bg-accent-gradient text-accent-foreground text-xs font-bold shadow-crimson grid place-items-center"
            >
              채널 OAuth 연결하기
            </button>
          )}
        </Card>

        {/* Queue */}
        <Card
          title="생성 · 발행 큐"
          icon={<Layers className="size-4 text-crimson" />}
          extra={queueItems.length > 0 ? `${queueItems.length} 작업` : undefined}
        >
          <div className="space-y-2">
            {queueItems.length === 0 ? (
              <div className="text-xs text-muted-foreground px-3 py-2">대기 작업 없음</div>
            ) : (
              queueItems.map((q) => (
                <div key={q.title} className="px-3 py-2 rounded-lg bg-secondary border border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate">{q.title}</span>
                    <QueueBadge s={q.status as "done" | "running" | "queued"} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Activity */}
        <Card title="최근 활동" icon={<Activity className="size-4 text-primary" />}>
          <ul className="space-y-3 text-xs">
            {activities.length === 0 ? (
              <li className="text-muted-foreground px-1">활동 기록 없음</li>
            ) : (
              activities.map((a) => (
                <li key={a.createdAt + a.action} className="flex items-start gap-2">
                  <div className="mt-0.5">
                    {a.action.includes("publish") ? (
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                    ) : a.action.includes("fail") ? (
                      <AlertCircle className="size-3.5 text-accent" />
                    ) : (
                      <Bot className="size-3.5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-foreground/90">
                      {formatActivityLabel(a.action, a.resourceType)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {formatRelativeTime(a.createdAt)}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </aside>
  );
}

function formatActivityLabel(action: string, resourceType: string): string {
  const labels: Record<string, string> = {
    draft_saved: "드래프트 저장",
    post_published: "소셜 발행 완료",
    role_assigned: "역할 변경",
    generation_enqueued: "AI 작업 등록",
    generation_completed: "AI 생성 완료",
    generation_failed: "AI 생성 실패",
    bulk_generation_enqueued: "대량 생성 등록",
  };
  return labels[action] ?? `${resourceType}: ${action}`;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

function Card({
  title,
  icon,
  extra,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  extra?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-secondary/60 border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs font-semibold">{title}</span>
        {extra && <span className="ml-auto text-[10px] font-mono text-muted-foreground">{extra}</span>}
      </div>
      {children}
    </div>
  );
}

function QueueBadge({ s }: { s: "done" | "running" | "queued" }) {
  if (s === "done")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
        <Check className="size-3" /> 완료
      </span>
    );
  if (s === "running")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
        <Loader2 className="size-3 animate-spin" /> 진행중
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
      <Clock className="size-3" /> 대기
    </span>
  );
}
