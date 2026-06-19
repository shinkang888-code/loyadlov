// filepath: src/components/SocialPublishPanel.tsx
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ALL_SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  type NaverBlogPostOptions,
  type SocialPlatform,
  type SocialPostPublic,
  type SocialPostStatus,
} from "@/lib/social/types";
import { useSocialAccounts } from "@/hooks/useSocialAccounts";
import {
  createSocialPostFn,
  disconnectSocialAccountFn,
  generateSocialAiDraftFn,
  listNaverCategoriesFn,
  listSocialPostsFn,
  publishSocialPostFn,
  retrySocialPostFn,
} from "@/lib/social.functions";
import {
  Check,
  Link2,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Unlink,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

type NaverCategory = { categoryNo: number; name: string };

const STATUS_LABEL: Record<SocialPostStatus, string> = {
  draft: "임시저장",
  scheduled: "예약",
  published: "발행됨",
  failed: "실패",
};

const PLATFORM_HINT: Record<SocialPlatform, string> = {
  instagram: "이미지 또는 동영상 URL 필수",
  threads: "텍스트만 가능, 이미지/동영상 URL 선택",
  youtube: "동영상 URL(mp4/mov/webm) 필수",
  naver_blog: "첫 줄=제목, 이하=본문. 이미지 URL 선택",
};

type Props = {
  storeName?: string;
  industry?: string;
  onPublishSuccess?: () => void;
  onRequestOAuthSetup?: () => void;
};

export function SocialPublishPanel({ storeName, industry, onPublishSuccess, onRequestOAuthSetup }: Props) {
  const listPosts = useServerFn(listSocialPostsFn);
  const createPost = useServerFn(createSocialPostFn);
  const publishPost = useServerFn(publishSocialPostFn);
  const retryPost = useServerFn(retrySocialPostFn);
  const disconnect = useServerFn(disconnectSocialAccountFn);
  const aiDraft = useServerFn(generateSocialAiDraftFn);
  const naverCats = useServerFn(listNaverCategoriesFn);
  const { accounts, config, loading, refresh, isConnected } = useSocialAccounts();

  const [posts, setPosts] = useState<SocialPostPublic[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [topic, setTopic] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [naverCategoryNo, setNaverCategoryNo] = useState<number | "">("");
  const [naverOpenType, setNaverOpenType] = useState<NaverBlogPostOptions["openType"]>("all");
  const [naverCategories, setNaverCategories] = useState<NaverCategory[]>([]);

  const loadPosts = useCallback(async () => {
    try {
      const post = await listPosts();
      setPosts((post as { posts: SocialPostPublic[] }).posts ?? []);
    } catch {
      toast.error("발행 기록을 불러오지 못했습니다.");
    }
  }, [listPosts]);

  const loadData = useCallback(async () => {
    await Promise.all([refresh(), loadPosts()]);
  }, [refresh, loadPosts]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    const p = params.get("platform");
    if (oauth === "success") {
      if (params.get("warn") === "partial") {
        toast.success(`${p ?? "Meta"} 연결됨 — IG Business 또는 Threads 프로필 확인 필요`);
      } else if (params.get("warn") === "no_blog") {
        toast.success("네이버 연결됨 — 블로그 카테고리가 없습니다.");
      } else {
        toast.success(`${p === "naver" ? "네이버 블로그" : p ?? "소셜"} 계정 연결 완료`);
      }
      void loadData();
      window.history.replaceState({}, "", "/admin?tab=channels");
    } else if (oauth === "error") {
      toast.error(`연결 실패: ${params.get("message") ?? "unknown"}`);
      window.history.replaceState({}, "", "/admin?tab=channels");
    }
  }, [loadData]);

  useEffect(() => {
    if (platform !== "naver_blog") return;
    void naverCats()
      .then((d) => {
        const cats = d.categories ?? [];
        setNaverCategories(cats);
        if (cats[0] && naverCategoryNo === "") setNaverCategoryNo(cats[0].categoryNo);
      })
      .catch(() => {});
  }, [platform, naverCategoryNo, naverCats]);

  const connectedForPlatform = isConnected(platform);

  const startOAuth = async (path: string, configured: boolean) => {
    if (!configured) {
      toast.info("먼저 OAuth API 자격증명을 설정해주세요.");
      onRequestOAuthSetup?.();
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      toast.error("로그인이 필요합니다.");
      return;
    }
    window.location.href = `${path}?token=${encodeURIComponent(token)}`;
  };

  const handleDisconnect = async (id: string) => {
    try {
      await disconnect({ data: { accountId: id } });
      toast.success("연결 해제됨");
      void loadData();
    } catch {
      toast.error("연결 해제 실패");
    }
  };

  const handleAiDraft = async () => {
    if (!topic.trim()) {
      toast.error("주제를 입력하세요.");
      return;
    }
    setAiLoading(true);
    try {
      const res = await aiDraft({
        data: { topic, platform, storeName, industry, tone: "감성적이고 신뢰감 있는" },
      });
      if (res.caption) setCaption(res.caption);
      toast.success("AI 초안 생성 완료");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI 생성 실패");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveAndPublish = async (immediate: boolean) => {
    if (!caption.trim()) {
      toast.error("본문을 입력하세요.");
      return;
    }
    if (!connectedForPlatform) {
      toast.error(`${SOCIAL_PLATFORM_LABELS[platform]} 계정을 먼저 연결하세요.`);
      return;
    }
    setSaving(true);
    try {
      const platformOptions: Record<string, unknown> =
        platform === "naver_blog"
          ? {
              categoryNo: naverCategoryNo === "" ? undefined : naverCategoryNo,
              openType: naverOpenType,
            }
          : {};

      const { post } = await createPost({
        data: {
          platform,
          caption,
          mediaUrls: mediaUrl.trim() ? [mediaUrl.trim()] : [],
          scheduledAt: immediate ? null : scheduledAt || null,
          platformOptions,
        },
      });

      if (immediate || !scheduledAt) {
        await publishPost({ data: { postId: post.id } });
        toast.success("발행 완료!");
        onPublishSuccess?.();
      } else {
        toast.success("예약 등록 완료");
      }
      void loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "발행 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = async (postId: string) => {
    setRetryingId(postId);
    try {
      await retryPost({ data: { postId } });
      toast.success("재발행 완료");
      void loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "재시도 실패");
    } finally {
      setRetryingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" /> 소셜 발행 로딩 중…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto flex-1">
      {/* 계정 연결 */}
      <section className="rounded-2xl bg-card border border-border p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <Link2 className="size-4 text-primary" /> 채널 OAuth 연결
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ALL_SOCIAL_PLATFORMS.map((p) => {
            const acc = accounts.find((a) => a.platform === p);
            return (
              <div key={p} className="rounded-xl border border-border p-4 bg-secondary/40">
                <div className="text-xs font-semibold">{SOCIAL_PLATFORM_LABELS[p]}</div>
                {acc ? (
                  <div className="mt-2">
                    <div className="text-[11px] text-muted-foreground truncate">{acc.displayName}</div>
                    <button
                      onClick={() => void handleDisconnect(acc.id)}
                      className="mt-2 text-[11px] text-accent inline-flex items-center gap-1 hover:underline"
                    >
                      <Unlink className="size-3" /> 연결 해제
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-muted-foreground">미연결</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => void startOAuth("/api/social/meta/oauth/start", config.meta)}
            className="px-3 py-1.5 rounded-lg bg-brand text-primary-foreground text-xs font-semibold"
          >
            Meta (IG+Threads)
          </button>
          <button
            onClick={() => void startOAuth("/api/social/youtube/oauth/start", config.youtube)}
            className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-semibold"
          >
            YouTube
          </button>
          <button
            onClick={() => void startOAuth("/api/social/naver/oauth/start", config.naver)}
            className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-semibold"
          >
            네이버 블로그
          </button>
          {!config.meta && !config.youtube && !config.naver && (
            <button
              onClick={() => onRequestOAuthSetup?.()}
              className="px-3 py-1.5 rounded-lg bg-accent-gradient text-accent-foreground text-xs font-bold"
            >
              API 설정하기
            </button>
          )}
          <button onClick={() => void loadData()} className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground inline-flex items-center gap-1">
            <RefreshCw className="size-3" /> 새로고침
          </button>
        </div>
      </section>

      {/* 콘텐츠 작성 */}
      <section className="rounded-2xl bg-card border border-border p-5">
        <h2 className="text-sm font-semibold mb-4">콘텐츠 작성 & 발행</h2>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground">플랫폼</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
              className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
            >
              {ALL_SOCIAL_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {SOCIAL_PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">{PLATFORM_HINT[platform]}</p>

            <label className="text-[11px] uppercase tracking-widest text-muted-foreground">주제 / 키워드</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: 신메뉴 출시, 주말 한정"
              className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
            />

            <button
              onClick={() => void handleAiDraft()}
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-primary-foreground text-xs font-semibold disabled:opacity-60"
            >
              {aiLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              AI 초안 생성
            </button>

            <label className="text-[11px] uppercase tracking-widest text-muted-foreground">본문</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={8}
              className="w-full p-3 rounded-xl bg-secondary border border-border text-sm resize-none"
            />

            <label className="text-[11px] uppercase tracking-widest text-muted-foreground">미디어 URL</label>
            <input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://..."
              className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
            />

            {platform === "naver_blog" && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground">카테고리</label>
                  <select
                    value={naverCategoryNo}
                    onChange={(e) => setNaverCategoryNo(Number(e.target.value))}
                    className="w-full h-9 px-2 rounded-lg bg-secondary border border-border text-xs mt-1"
                  >
                    {naverCategories.map((c) => (
                      <option key={c.categoryNo} value={c.categoryNo}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground">공개 설정</label>
                  <select
                    value={naverOpenType}
                    onChange={(e) => setNaverOpenType(e.target.value as NaverBlogPostOptions["openType"])}
                    className="w-full h-9 px-2 rounded-lg bg-secondary border border-border text-xs mt-1"
                  >
                    <option value="all">전체공개</option>
                    <option value="neighbor">이웃공개</option>
                    <option value="agreedNeighbor">서로이웃공개</option>
                    <option value="closed">비공개</option>
                  </select>
                </div>
              </div>
            )}

            <label className="text-[11px] uppercase tracking-widest text-muted-foreground">예약 발행 (선택)</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
            />
          </div>

          <div>
            <div className="text-xs font-semibold mb-3">발행 히스토리</div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {posts.length === 0 && (
                <p className="text-xs text-muted-foreground">아직 발행 기록이 없습니다.</p>
              )}
              {posts.map((p) => (
                <div key={p.id} className="px-3 py-2 rounded-lg bg-secondary border border-border text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{SOCIAL_PLATFORM_LABELS[p.platform]}</span>
                    <span
                      className={`text-[10px] font-semibold ${
                        p.status === "published"
                          ? "text-emerald-600"
                          : p.status === "failed"
                            ? "text-accent"
                            : "text-muted-foreground"
                      }`}
                    >
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground line-clamp-2">{p.caption}</p>
                  {p.status === "failed" && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] text-accent flex items-center gap-1">
                        <AlertCircle className="size-3" /> {p.errorMessage}
                      </span>
                      <button
                        onClick={() => void handleRetry(p.id)}
                        disabled={retryingId === p.id}
                        className="text-[10px] text-primary font-semibold"
                      >
                        {retryingId === p.id ? "재시도 중…" : "재시도"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => void handleSaveAndPublish(false)}
            disabled={saving || !connectedForPlatform}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-secondary border border-border text-sm font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {scheduledAt ? "예약 등록" : "임시저장"}
          </button>
          <button
            onClick={() => void handleSaveAndPublish(true)}
            disabled={saving || !connectedForPlatform}
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-accent-gradient text-accent-foreground text-sm font-bold disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            즉시 발행
          </button>
          {connectedForPlatform ? (
            <span className="text-xs text-emerald-600 self-center inline-flex items-center gap-1">
              <CheckCircle2 className="size-3.5" /> {SOCIAL_PLATFORM_LABELS[platform]} 연결됨
            </span>
          ) : (
            <span className="text-xs text-accent self-center">계정 연결 필요</span>
          )}
        </div>
      </section>
    </div>
  );
}
