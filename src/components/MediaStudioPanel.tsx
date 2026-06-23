// filepath: src/components/MediaStudioPanel.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Image as ImageIcon, LayoutGrid, Loader2, Sparkles, Video, Wand2 } from "lucide-react";
import {
  enqueueMediaGenFn,
  getMediaJobFn,
  listMediaAssetsFn,
} from "@/lib/aiIntegrations.functions";

type Asset = {
  id: string;
  provider: string;
  kind: string;
  prompt: string | null;
  url: string;
  thumb_url: string | null;
  created_at: string;
};

type Mode = "image" | "video" | "cardnews";
type ImageProvider = "gemini" | "higgsfield";
type CardSource = "gemini" | "higgsfield" | "figma" | "canva";

const SIZE_OPTIONS = [
  { value: "1536x1536", label: "정사각 1:1 (1536²)" },
  { value: "2048x1152", label: "가로 16:9 (2048×1152)" },
  { value: "1152x2048", label: "세로 9:16 (1152×2048)" },
];

export function MediaStudioPanel({ storeCode }: { storeCode?: string }) {
  const enqueue = useServerFn(enqueueMediaGenFn);
  const getJob = useServerFn(getMediaJobFn);
  const listAssets = useServerFn(listMediaAssetsFn);

  const [mode, setMode] = useState<Mode>("image");
  const [prompt, setPrompt] = useState("");
  const [imageProvider, setImageProvider] = useState<ImageProvider>("gemini");
  const [size, setSize] = useState("1536x1536");
  const [quality, setQuality] = useState("1080p");
  const [imageUrl, setImageUrl] = useState("");

  // 카드뉴스
  const [cardSource, setCardSource] = useState<CardSource>("gemini");
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState(5);
  const [style, setStyle] = useState("");
  const [figmaFileKey, setFigmaFileKey] = useState("");
  const [figmaNodeIds, setFigmaNodeIds] = useState("");

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [assets, setAssets] = useState<Asset[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAssets = useCallback(async () => {
    try {
      const rows = await listAssets({ data: storeCode ? { storeCode } : {} });
      setAssets(rows as Asset[]);
    } catch {
      /* noop */
    }
  }, [listAssets, storeCode]);

  useEffect(() => {
    void loadAssets();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadAssets]);

  function buildPayload() {
    if (mode === "cardnews") {
      if (cardSource === "canva") {
        throw new Error("Canva는 OAuth 연결이 필요해 아직 자동 생성이 지원되지 않습니다.");
      }
      if (cardSource === "figma") {
        const ids = figmaNodeIds
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (!figmaFileKey.trim() || ids.length === 0) {
          throw new Error("Figma 파일 키와 노드 ID(쉼표 구분)를 입력하세요.");
        }
        return {
          storeCode,
          provider: "figma" as const,
          kind: "cardnews" as const,
          topic: topic.trim() || "카드뉴스",
          figmaFileKey: figmaFileKey.trim(),
          figmaNodeIds: ids,
        };
      }
      if (!topic.trim()) throw new Error("카드뉴스 주제를 입력하세요.");
      return {
        storeCode,
        provider: cardSource,
        kind: "cardnews" as const,
        topic: topic.trim(),
        slideCount,
        style: style.trim() || undefined,
      };
    }
    if (mode === "video") {
      if (!prompt.trim()) throw new Error("프롬프트를 입력하세요.");
      return {
        storeCode,
        provider: "higgsfield" as const,
        kind: "video" as const,
        prompt: prompt.trim(),
        ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
      };
    }
    // image
    if (!prompt.trim()) throw new Error("프롬프트를 입력하세요.");
    return {
      storeCode,
      provider: imageProvider,
      kind: "image" as const,
      prompt: prompt.trim(),
      ...(imageProvider === "higgsfield" ? { size, quality } : {}),
    };
  }

  async function handleGenerate() {
    let payload: ReturnType<typeof buildPayload>;
    try {
      payload = buildPayload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "입력을 확인하세요.");
      return;
    }

    setBusy(true);
    setProgress(5);
    try {
      const { jobId } = await enqueue({ data: payload });

      await new Promise<void>((resolve) => {
        let ticks = 0;
        pollRef.current = setInterval(async () => {
          ticks += 1;
          try {
            const job = await getJob({ data: { jobId } });
            if (job?.progress) setProgress(job.progress);
            if (job?.status === "completed") {
              if (pollRef.current) clearInterval(pollRef.current);
              setProgress(100);
              toast.success("생성 완료");
              await loadAssets();
              resolve();
            } else if (job?.status === "failed") {
              if (pollRef.current) clearInterval(pollRef.current);
              toast.error(job.error_message ?? "생성 실패");
              resolve();
            } else if (ticks > 160) {
              if (pollRef.current) clearInterval(pollRef.current);
              toast.message("생성이 진행 중입니다. 잠시 후 갤러리를 새로고침하세요.");
              await loadAssets();
              resolve();
            } else if (ticks % 4 === 0) {
              await loadAssets();
            }
          } catch {
            /* keep polling */
          }
        }, 2500);
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "생성 요청 실패");
    } finally {
      setBusy(false);
    }
  }

  const ModeButton = ({ value, label, Icon }: { value: Mode; label: string; Icon: typeof ImageIcon }) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border ${
        mode === value
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-secondary border-border text-muted-foreground"
      }`}
    >
      <Icon className="size-4" /> {label}
    </button>
  );

  return (
    <div className="p-6 space-y-6 overflow-y-auto flex-1">
      <div className="rounded-2xl bg-card border border-border p-5 space-y-4 max-w-2xl">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> 미디어 생성 스튜디오
        </h2>

        <div className="flex gap-2 flex-wrap">
          <ModeButton value="image" label="이미지" Icon={ImageIcon} />
          <ModeButton value="video" label="영상" Icon={Video} />
          <ModeButton value="cardnews" label="카드뉴스" Icon={LayoutGrid} />
        </div>

        {/* 이미지 모드 */}
        {mode === "image" && (
          <>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold">생성 엔진</span>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setImageProvider("gemini")}
                  className={`h-9 px-3 rounded-lg text-xs font-medium border ${
                    imageProvider === "gemini"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border text-muted-foreground"
                  }`}
                >
                  Gemini 나노바나나
                </button>
                <button
                  type="button"
                  onClick={() => setImageProvider("higgsfield")}
                  className={`h-9 px-3 rounded-lg text-xs font-medium border ${
                    imageProvider === "higgsfield"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary border-border text-muted-foreground"
                  }`}
                >
                  Higgsfield
                </button>
              </div>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="생성할 장면을 설명하세요. 예) 따뜻한 조명의 카페 인테리어, 시그니처 라떼 클로즈업"
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            {imageProvider === "higgsfield" && (
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs space-y-1.5">
                  <span className="font-semibold">사이즈</span>
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
                  >
                    {SIZE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs space-y-1.5">
                  <span className="font-semibold">품질</span>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
                  >
                    <option value="1080p">HD (1080p)</option>
                    <option value="720p">SD (720p)</option>
                  </select>
                </label>
              </div>
            )}
            {imageProvider === "gemini" && (
              <p className="text-[11px] text-muted-foreground">
                나노바나나(gemini-2.5-flash-image)는 1024px 정사각 이미지를 생성합니다. 「설정 &amp; API」에서 GEMINI_API_KEY 필요.
              </p>
            )}
          </>
        )}

        {/* 영상 모드 */}
        {mode === "video" && (
          <>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="영상으로 만들 장면을 설명하세요."
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="(선택) 시작 이미지 URL — image-to-video"
              className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm font-mono"
            />
            <p className="text-[11px] text-muted-foreground">Higgsfield DoP 엔진 사용.</p>
          </>
        )}

        {/* 카드뉴스 모드 */}
        {mode === "cardnews" && (
          <>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold">슬라이드 생성 소스</span>
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    ["gemini", "Gemini 나노바나나"],
                    ["higgsfield", "Higgsfield"],
                    ["figma", "Figma 템플릿"],
                    ["canva", "Canva"],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCardSource(val)}
                    className={`h-9 px-3 rounded-lg text-xs font-medium border ${
                      cardSource === val
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary border-border text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {cardSource === "canva" ? (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                Canva는 Connect API OAuth 2.0 연결(브랜드 템플릿 Autofill은 Enterprise 권한)이 필요해 현재 자동
                슬라이드 생성은 지원하지 않습니다. 나노바나나/Higgsfield(AI 생성) 또는 Figma 템플릿을 사용하세요.
              </p>
            ) : cardSource === "figma" ? (
              <>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="카드뉴스 제목/메모 (선택)"
                  className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
                />
                <input
                  value={figmaFileKey}
                  onChange={(e) => setFigmaFileKey(e.target.value)}
                  placeholder="Figma 파일 키 (figma.com/file/{KEY}/...)"
                  className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm font-mono"
                />
                <input
                  value={figmaNodeIds}
                  onChange={(e) => setFigmaNodeIds(e.target.value)}
                  placeholder="프레임 노드 ID 목록 (쉼표 구분, 예: 1:23, 1:45)"
                  className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  지정한 Figma 프레임들을 슬라이드 이미지로 내보냅니다. 「설정 &amp; API」에서 FIGMA_TOKEN 필요.
                </p>
              </>
            ) : (
              <>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="카드뉴스 주제. 예) 신메뉴 출시 안내, 매장 이벤트"
                  className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="text-xs space-y-1.5">
                    <span className="font-semibold">슬라이드 수</span>
                    <select
                      value={slideCount}
                      onChange={(e) => setSlideCount(Number(e.target.value))}
                      className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
                    >
                      {[3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n}>
                          {n}장
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs space-y-1.5">
                    <span className="font-semibold">스타일 (선택)</span>
                    <input
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                      placeholder="예) 파스텔, 미니멀"
                      className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
                    />
                  </label>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  주제를 슬라이드별 문구로 나눈 뒤 각 슬라이드를 {cardSource === "gemini" ? "나노바나나" : "Higgsfield"}로 생성합니다.
                </p>
              </>
            )}
          </>
        )}

        {busy && (
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-brand transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={busy || (mode === "cardnews" && cardSource === "canva")}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-brand text-primary-foreground text-sm font-semibold disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          {busy ? "생성 중…" : mode === "cardnews" ? "카드뉴스 생성" : "생성하기"}
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">생성 갤러리</h3>
        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 생성된 미디어가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {assets.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl overflow-hidden border border-border bg-secondary aspect-square block relative"
                title={a.prompt ?? ""}
              >
                {a.kind === "video" ? (
                  <video src={a.url} className="w-full h-full object-cover" muted />
                ) : (
                  <img
                    src={a.thumb_url ?? a.url}
                    alt={a.prompt ?? "media"}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                )}
                {a.kind === "cardnews" && (
                  <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-black/60 text-white">
                    카드뉴스
                  </span>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
