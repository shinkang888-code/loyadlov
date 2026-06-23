// filepath: src/components/MediaStudioPanel.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, Sparkles, Video, Wand2 } from "lucide-react";
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

const SIZE_OPTIONS = [
  { value: "1536x1536", label: "정사각 1:1 (1536²)" },
  { value: "2048x1152", label: "가로 16:9 (2048×1152)" },
  { value: "1152x2048", label: "세로 9:16 (1152×2048)" },
];

export function MediaStudioPanel({ storeCode }: { storeCode?: string }) {
  const enqueue = useServerFn(enqueueMediaGenFn);
  const getJob = useServerFn(getMediaJobFn);
  const listAssets = useServerFn(listMediaAssetsFn);

  const [kind, setKind] = useState<"image" | "video">("image");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1536x1536");
  const [quality, setQuality] = useState("1080p");
  const [imageUrl, setImageUrl] = useState("");
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

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error("프롬프트를 입력하세요.");
      return;
    }
    setBusy(true);
    setProgress(5);
    try {
      const { jobId } = await enqueue({
        data: {
          storeCode,
          provider: "higgsfield",
          kind,
          prompt: prompt.trim(),
          ...(kind === "image" ? { size, quality } : {}),
          ...(kind === "video" && imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
        },
      });

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
              toast.success("미디어 생성 완료");
              await loadAssets();
              resolve();
            } else if (job?.status === "failed") {
              if (pollRef.current) clearInterval(pollRef.current);
              toast.error(job.error_message ?? "생성 실패");
              resolve();
            } else if (ticks > 120) {
              if (pollRef.current) clearInterval(pollRef.current);
              toast.message("생성이 진행 중입니다. 잠시 후 갤러리를 새로고침하세요.");
              resolve();
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

  return (
    <div className="p-6 space-y-6 overflow-y-auto flex-1">
      <div className="rounded-2xl bg-card border border-border p-5 space-y-4 max-w-2xl">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> 미디어 생성 스튜디오 (Higgsfield)
        </h2>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setKind("image")}
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border ${
              kind === "image"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary border-border text-muted-foreground"
            }`}
          >
            <ImageIcon className="size-4" /> 이미지
          </button>
          <button
            type="button"
            onClick={() => setKind("video")}
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border ${
              kind === "video"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary border-border text-muted-foreground"
            }`}
          >
            <Video className="size-4" /> 영상
          </button>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="생성할 장면을 설명하세요. 예) 따뜻한 조명의 카페 인테리어, 시그니처 라떼 클로즈업"
          rows={3}
          className="w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
        />

        {kind === "image" ? (
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
        ) : (
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="(선택) 시작 이미지 URL — image-to-video"
            className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm font-mono"
          />
        )}

        {busy && (
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-brand transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={busy}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-brand text-primary-foreground text-sm font-semibold disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          {busy ? "생성 중…" : "생성하기"}
        </button>

        <p className="text-[11px] text-muted-foreground">
          Higgsfield 자격증명은 「설정 &amp; API」 탭에서 등록합니다. 영상·고해상도 생성은 수십 초~수 분 걸릴 수 있습니다.
        </p>
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
                className="group rounded-xl overflow-hidden border border-border bg-secondary aspect-square block"
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
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
