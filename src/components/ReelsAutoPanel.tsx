/**
 * ReelsAutoPanel — MoneyPrinterTurbo 워크플로우의 프론트 이식 버전
 *
 * 원본(MPT) 단계:
 *  1) Subject  → 2) Script (LLM) → 3) Search terms (LLM) →
 *  4) Stock videos (Pexels/Pixabay) → 5) TTS voiceover →
 *  6) Subtitle render → 7) BGM mix → 8) ffmpeg compose → mp4
 *
 * Lovable 런타임에서는 서버측 ffmpeg 합성이 불가능하므로
 * (1~4)는 자동화하고, (5~8)은 브라우저 프리뷰 + 옵션 선택 + 에셋 다운로드 형태로 제공.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Film,
  Wand2,
  Loader2,
  Download,
  RefreshCw,
  Play,
  Pause,
  ExternalLink,
  Music2,
  Type as TypeIcon,
  Volume2,
  Languages,
  Aperture,
  Sparkles,
  Info,
  Check,
} from "lucide-react";
import {
  generateReelsScript,
  searchReelsStockClips,
  getReelsProviderStatus,
  type StockClip,
} from "@/lib/reels.functions";

type Language = "ko" | "en" | "ja" | "zh" | "es";
type Tone = "informative" | "casual" | "energetic" | "calm" | "humorous";
type Aspect = "portrait" | "landscape" | "square";

const LANG_OPTS: { v: Language; label: string }[] = [
  { v: "ko", label: "한국어" },
  { v: "en", label: "English" },
  { v: "ja", label: "日本語" },
  { v: "zh", label: "中文" },
  { v: "es", label: "Español" },
];
const TONE_OPTS: { v: Tone; label: string }[] = [
  { v: "informative", label: "정보 전달" },
  { v: "casual", label: "캐주얼" },
  { v: "energetic", label: "에너제틱" },
  { v: "calm", label: "차분함" },
  { v: "humorous", label: "유머" },
];
const ASPECT_OPTS: { v: Aspect; label: string; ratio: string }[] = [
  { v: "portrait", label: "9:16 세로", ratio: "9 / 16" },
  { v: "landscape", label: "16:9 가로", ratio: "16 / 9" },
  { v: "square", label: "1:1 정사각", ratio: "1 / 1" },
];

const VOICE_OPTS = [
  { id: "ko-KR-Female-1", label: "한국어 · 여성 1 (차분)" },
  { id: "ko-KR-Male-1", label: "한국어 · 남성 1 (신뢰)" },
  { id: "ko-KR-Female-2", label: "한국어 · 여성 2 (에너제틱)" },
  { id: "en-US-Female-1", label: "English · Female (warm)" },
  { id: "en-US-Male-1", label: "English · Male (announcer)" },
];

const BGM_OPTS = [
  { id: "none", label: "BGM 사용 안 함" },
  { id: "uplift", label: "Uplift / 밝고 경쾌" },
  { id: "chill", label: "Chill / 잔잔한 비트" },
  { id: "cinematic", label: "Cinematic / 영화적" },
  { id: "corporate", label: "Corporate / 깔끔한 코퍼레이트" },
];

export function ReelsAutoPanel({ storeCode }: { storeCode?: string }) {
  const genScript = useServerFn(generateReelsScript);
  const searchClips = useServerFn(searchReelsStockClips);
  const status = useServerFn(getReelsProviderStatus);

  /* ---- step 1: form state ---- */
  const [subject, setSubject] = useState("");
  const [language, setLanguage] = useState<Language>("ko");
  const [tone, setTone] = useState<Tone>("informative");
  const [paragraphs, setParagraphs] = useState(2);
  const [aspect, setAspect] = useState<Aspect>("portrait");
  const [clipDuration, setClipDuration] = useState(3); // 단일 클립 노출 길이
  const [minStockDuration, setMinStockDuration] = useState(4);
  const [voice, setVoice] = useState(VOICE_OPTS[0].id);
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [voiceVolume, setVoiceVolume] = useState(1);
  const [bgm, setBgm] = useState(BGM_OPTS[1].id);
  const [bgmVolume, setBgmVolume] = useState(0.2);
  const [subtitleEnabled, setSubtitleEnabled] = useState(true);
  const [subtitleFontSize, setSubtitleFontSize] = useState(60);
  const [subtitleColor, setSubtitleColor] = useState("#FFFFFF");
  const [subtitleStroke, setSubtitleStroke] = useState("#000000");
  const [subtitlePosition, setSubtitlePosition] = useState<"top" | "center" | "bottom">("bottom");

  /* ---- step 2: results state ---- */
  const [script, setScript] = useState("");
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [estDuration, setEstDuration] = useState(45);
  const [clips, setClips] = useState<StockClip[]>([]);
  const [provider, setProvider] = useState<"pexels" | "missing-key" | null>(null);
  const [pexelsConfigured, setPexelsConfigured] = useState<boolean | null>(null);
  const [loadingScript, setLoadingScript] = useState(false);
  const [loadingClips, setLoadingClips] = useState(false);

  useEffect(() => {
    void status({ data: undefined }).then((r) => setPexelsConfigured(r.pexelsConfigured)).catch(() => setPexelsConfigured(false));
  }, [status]);

  const runScript = async () => {
    if (!subject.trim()) {
      toast.error("주제를 입력해 주세요.");
      return;
    }
    setLoadingScript(true);
    try {
      const r = await genScript({ data: { subject, language, paragraphs, tone } });
      setScript(r.script);
      setSearchTerms(r.searchTerms);
      setEstDuration(r.estimatedDurationSec);
      toast.success("스크립트 생성 완료");
    } catch (e: any) {
      toast.error(e?.message ?? "스크립트 생성 실패");
    } finally {
      setLoadingScript(false);
    }
  };

  const runClips = async (termsOverride?: string[]) => {
    const terms = (termsOverride ?? searchTerms).filter(Boolean);
    if (!terms.length) {
      toast.error("먼저 스크립트를 생성해 검색어를 받으세요.");
      return;
    }
    setLoadingClips(true);
    try {
      const r = await searchClips({
        data: { terms, orientation: aspect, perTerm: 2, minDurationSec: minStockDuration },
      });
      setClips(r.clips);
      setProvider(r.provider);
      if (r.provider === "missing-key") {
        toast.error("PEXELS_API_KEY 환경변수가 비어 있어요. 설정 후 다시 시도해 주세요.");
      } else if (r.clips.length === 0) {
        toast.message("검색 결과가 없습니다. 검색어를 조정해 보세요.");
      } else {
        toast.success(`${r.clips.length}개 스톡 클립 수집`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "스톡 영상 검색 실패");
    } finally {
      setLoadingClips(false);
    }
  };

  const runAll = async () => {
    if (!subject.trim()) {
      toast.error("주제를 입력해 주세요.");
      return;
    }
    setLoadingScript(true);
    try {
      const r = await genScript({ data: { subject, language, paragraphs, tone } });
      setScript(r.script);
      setSearchTerms(r.searchTerms);
      setEstDuration(r.estimatedDurationSec);
      setLoadingScript(false);
      await runClips(r.searchTerms);
    } catch (e: any) {
      setLoadingScript(false);
      toast.error(e?.message ?? "자동 생성 실패");
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-secondary/40">
      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-brand text-primary-foreground grid place-items-center shadow-navy">
            <Film className="size-6" />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold">릴스 자동 생성</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              주제 한 줄로 스크립트 · 스톡 영상 · 자막 · 보이스오버까지 한 번에 (MoneyPrinterTurbo 워크플로우 이식판)
            </p>
          </div>
          {storeCode && (
            <span className="text-xs font-mono text-muted-foreground bg-card border border-border px-2.5 py-1 rounded-lg">
              #{storeCode}
            </span>
          )}
        </div>

        {/* Provider notices */}
        {pexelsConfigured === false && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 p-4 flex gap-3">
            <Info className="size-5 mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold">Pexels API 키가 설정되지 않았어요</div>
              <p className="mt-1">
                관리자에게 <code className="bg-amber-100 px-1.5 py-0.5 rounded">PEXELS_API_KEY</code> 환경변수 설정을
                요청하세요. 키가 없어도 스크립트 + 검색어 자동 추출은 정상 동작합니다.
              </p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-[420px_1fr] gap-6">
          {/* ============== LEFT : settings ============== */}
          <div className="space-y-4">
            {/* Subject */}
            <Card title="주제" icon={<Wand2 className="size-4" />}>
              <textarea
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                rows={3}
                placeholder="예: 30대를 위한 시간 관리 5가지 비법"
                className="w-full rounded-xl border border-border bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={runScript}
                  disabled={loadingScript || loadingClips}
                  className="h-10 rounded-xl border border-border bg-secondary text-sm font-medium hover:bg-secondary/80 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  {loadingScript ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                  스크립트만
                </button>
                <button
                  type="button"
                  onClick={runAll}
                  disabled={loadingScript || loadingClips}
                  className="h-10 rounded-xl bg-brand text-primary-foreground text-sm font-semibold shadow-navy hover:opacity-90 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  {loadingScript || loadingClips ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  전체 자동 생성
                </button>
              </div>
            </Card>

            {/* Script options */}
            <Card title="스크립트 옵션" icon={<Languages className="size-4" />}>
              <Field label="언어">
                <SelectChips
                  value={language}
                  onChange={(v) => setLanguage(v as Language)}
                  options={LANG_OPTS.map((o) => ({ value: o.v, label: o.label }))}
                />
              </Field>
              <Field label="톤앤매너">
                <SelectChips
                  value={tone}
                  onChange={(v) => setTone(v as Tone)}
                  options={TONE_OPTS.map((o) => ({ value: o.v, label: o.label }))}
                />
              </Field>
              <Field label={`단락 수 · ${paragraphs}개`}>
                <input
                  type="range"
                  min={1}
                  max={6}
                  value={paragraphs}
                  onChange={(e) => setParagraphs(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </Field>
            </Card>

            {/* Video options */}
            <Card title="영상 옵션" icon={<Aperture className="size-4" />}>
              <Field label="화면 비율">
                <SelectChips
                  value={aspect}
                  onChange={(v) => setAspect(v as Aspect)}
                  options={ASPECT_OPTS.map((o) => ({ value: o.v, label: o.label }))}
                />
              </Field>
              <Field label={`클립당 노출 시간 · ${clipDuration}s`}>
                <input
                  type="range"
                  min={2}
                  max={8}
                  value={clipDuration}
                  onChange={(e) => setClipDuration(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </Field>
              <Field label={`스톡 영상 최소 길이 · ${minStockDuration}s`}>
                <input
                  type="range"
                  min={2}
                  max={15}
                  value={minStockDuration}
                  onChange={(e) => setMinStockDuration(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </Field>
            </Card>

            {/* Voice */}
            <Card title="보이스오버 (TTS)" icon={<Volume2 className="size-4" />}>
              <Field label="음성">
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm"
                >
                  {VOICE_OPTS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`속도 · ${voiceSpeed.toFixed(2)}x`}>
                  <input
                    type="range"
                    min={0.75}
                    max={1.5}
                    step={0.05}
                    value={voiceSpeed}
                    onChange={(e) => setVoiceSpeed(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </Field>
                <Field label={`볼륨 · ${Math.round(voiceVolume * 100)}%`}>
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={voiceVolume}
                    onChange={(e) => setVoiceVolume(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </Field>
              </div>
            </Card>

            {/* BGM */}
            <Card title="배경음악 (BGM)" icon={<Music2 className="size-4" />}>
              <select
                value={bgm}
                onChange={(e) => setBgm(e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-card px-3 text-sm"
              >
                {BGM_OPTS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Field label={`BGM 볼륨 · ${Math.round(bgmVolume * 100)}%`}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={bgmVolume}
                  onChange={(e) => setBgmVolume(Number(e.target.value))}
                  className="w-full accent-primary"
                  disabled={bgm === "none"}
                />
              </Field>
            </Card>

            {/* Subtitles */}
            <Card title="자막" icon={<TypeIcon className="size-4" />}>
              <label className="flex items-center gap-2 text-sm mb-3">
                <input
                  type="checkbox"
                  checked={subtitleEnabled}
                  onChange={(e) => setSubtitleEnabled(e.target.checked)}
                  className="accent-primary"
                />
                자막 사용
              </label>
              <div className={subtitleEnabled ? "space-y-2" : "space-y-2 opacity-50 pointer-events-none"}>
                <Field label={`글자 크기 · ${subtitleFontSize}px`}>
                  <input
                    type="range"
                    min={24}
                    max={120}
                    value={subtitleFontSize}
                    onChange={(e) => setSubtitleFontSize(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="자막 색">
                    <input
                      type="color"
                      value={subtitleColor}
                      onChange={(e) => setSubtitleColor(e.target.value)}
                      className="w-full h-10 rounded-xl border border-border bg-card"
                    />
                  </Field>
                  <Field label="외곽선">
                    <input
                      type="color"
                      value={subtitleStroke}
                      onChange={(e) => setSubtitleStroke(e.target.value)}
                      className="w-full h-10 rounded-xl border border-border bg-card"
                    />
                  </Field>
                </div>
                <Field label="자막 위치">
                  <SelectChips
                    value={subtitlePosition}
                    onChange={(v) => setSubtitlePosition(v as any)}
                    options={[
                      { value: "top", label: "상단" },
                      { value: "center", label: "가운데" },
                      { value: "bottom", label: "하단" },
                    ]}
                  />
                </Field>
              </div>
            </Card>
          </div>

          {/* ============== RIGHT : output ============== */}
          <div className="space-y-4 min-w-0">
            {/* Script output */}
            <Card
              title="① 스크립트"
              icon={<Wand2 className="size-4" />}
              right={
                script && (
                  <span className="text-[11px] text-muted-foreground">
                    예상 {estDuration}s · {script.length}자
                  </span>
                )
              }
            >
              {script ? (
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-border bg-card p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              ) : (
                <EmptyHint>주제를 입력하고 "스크립트만" 또는 "전체 자동 생성"을 눌러보세요.</EmptyHint>
              )}
            </Card>

            {/* Search terms + clips */}
            <Card
              title="② 스톡 영상 검색어"
              icon={<Sparkles className="size-4" />}
              right={
                searchTerms.length > 0 && (
                  <button
                    onClick={() => runClips()}
                    disabled={loadingClips}
                    className="text-xs font-semibold inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary border border-border hover:bg-secondary/80 disabled:opacity-50"
                  >
                    {loadingClips ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                    Pexels 재검색
                  </button>
                )
              }
            >
              {searchTerms.length === 0 ? (
                <EmptyHint>스크립트가 생성되면 AI가 검색어를 자동 추출합니다.</EmptyHint>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {searchTerms.map((t, i) => (
                    <span
                      key={`${t}-${i}`}
                      className="inline-flex items-center gap-1 text-xs bg-secondary border border-border rounded-full px-2.5 py-1 font-mono"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </Card>

            {/* Clip results + preview */}
            <Card title="③ 스톡 클립 & 프리뷰" icon={<Film className="size-4" />}>
              {clips.length === 0 ? (
                <EmptyHint>
                  {provider === "missing-key"
                    ? "PEXELS_API_KEY가 설정되어야 영상이 검색됩니다."
                    : "검색이 완료되면 자동으로 클립이 표시됩니다."}
                </EmptyHint>
              ) : (
                <ClipPreviewArea
                  clips={clips}
                  aspect={aspect}
                  clipDuration={clipDuration}
                  script={script}
                  subtitle={{
                    enabled: subtitleEnabled,
                    fontSize: subtitleFontSize,
                    color: subtitleColor,
                    stroke: subtitleStroke,
                    position: subtitlePosition,
                  }}
                />
              )}
            </Card>

            {/* Asset bundle */}
            {clips.length > 0 && (
              <Card title="④ 에셋 다운로드" icon={<Download className="size-4" />}>
                <p className="text-xs text-muted-foreground mb-3">
                  서버 ffmpeg 합성 대신, 수집된 스톡 클립과 스크립트를 묶어 로컬 편집기(Premiere/CapCut/MPT 등)에 그대로
                  사용할 수 있어요.
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      downloadJsonBundle({
                        subject,
                        script,
                        language,
                        tone,
                        aspect,
                        clipDuration,
                        voice: { id: voice, speed: voiceSpeed, volume: voiceVolume },
                        bgm: { id: bgm, volume: bgmVolume },
                        subtitle: {
                          enabled: subtitleEnabled,
                          fontSize: subtitleFontSize,
                          color: subtitleColor,
                          stroke: subtitleStroke,
                          position: subtitlePosition,
                        },
                        searchTerms,
                        clips,
                      })
                    }
                    className="h-10 rounded-xl border border-border bg-card text-sm font-medium hover:bg-secondary transition inline-flex items-center justify-center gap-1.5"
                  >
                    <Download className="size-4" /> 메타 JSON
                  </button>
                  <button
                    onClick={() => downloadScriptTxt(subject, script)}
                    className="h-10 rounded-xl border border-border bg-card text-sm font-medium hover:bg-secondary transition inline-flex items-center justify-center gap-1.5"
                  >
                    <Download className="size-4" /> 스크립트 TXT
                  </button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Sub components ---------------- */

function Card({
  title,
  icon,
  right,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card border border-border p-4 shadow-soft">
      <header className="flex items-center gap-2 mb-3">
        <div className="size-7 rounded-lg bg-secondary grid place-items-center text-foreground/70">{icon}</div>
        <h3 className="text-sm font-semibold flex-1">{title}</h3>
        {right}
      </header>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <label className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

function SelectChips({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`text-xs px-2.5 h-7 rounded-lg border transition ${
              active
                ? "bg-brand text-primary-foreground border-transparent shadow-soft"
                : "bg-secondary border-border hover:bg-secondary/80"
            }`}
          >
            {active && <Check className="size-3 inline mr-1 -mt-px" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground py-6 text-center">{children}</div>;
}

/* ---------------- Preview area (browser-side compositing) ---------------- */

function ClipPreviewArea({
  clips,
  aspect,
  clipDuration,
  script,
  subtitle,
}: {
  clips: StockClip[];
  aspect: Aspect;
  clipDuration: number;
  script: string;
  subtitle: {
    enabled: boolean;
    fontSize: number;
    color: string;
    stroke: string;
    position: "top" | "center" | "bottom";
  };
}) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const ratio = useMemo(() => ASPECT_OPTS.find((a) => a.v === aspect)?.ratio ?? "9 / 16", [aspect]);

  // 자막을 단락 단위로 분리하여 클립에 라운드로빈 배치
  const captions = useMemo(() => {
    return script
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [script]);

  // 클립 순차 재생
  useEffect(() => {
    if (!playing) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
    const t = window.setTimeout(() => {
      setIdx((i) => (i + 1) % clips.length);
    }, clipDuration * 1000);
    return () => window.clearTimeout(t);
  }, [idx, playing, clipDuration, clips.length]);

  const currentClip = clips[idx];
  const currentCaption = captions[idx % Math.max(captions.length, 1)] ?? "";

  const posClass =
    subtitle.position === "top"
      ? "top-4 items-start"
      : subtitle.position === "center"
        ? "inset-y-0 items-center"
        : "bottom-6 items-end";

  return (
    <div className="grid md:grid-cols-[1fr_280px] gap-4">
      {/* Preview stage */}
      <div className="space-y-2">
        <div
          className="relative w-full bg-black rounded-2xl overflow-hidden border border-border mx-auto"
          style={{ aspectRatio: ratio, maxWidth: aspect === "portrait" ? 360 : aspect === "square" ? 480 : 640 }}
        >
          {currentClip && (
            <video
              ref={videoRef}
              key={currentClip.id}
              src={currentClip.videoUrl}
              autoPlay={playing}
              muted
              playsInline
              loop
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {subtitle.enabled && currentCaption && (
            <div className={`absolute left-4 right-4 flex justify-center ${posClass} pointer-events-none`}>
              <div
                style={{
                  fontSize: Math.min(subtitle.fontSize * 0.4, 28),
                  color: subtitle.color,
                  WebkitTextStroke: `1.5px ${subtitle.stroke}`,
                  fontWeight: 800,
                  textAlign: "center",
                  lineHeight: 1.25,
                  textShadow: `0 2px 8px ${subtitle.stroke}`,
                }}
              >
                {currentCaption}
              </div>
            </div>
          )}
          <div className="absolute top-2 right-2 text-[10px] font-mono bg-black/60 text-white px-1.5 py-0.5 rounded">
            {idx + 1} / {clips.length}
          </div>
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="h-9 px-3 rounded-xl bg-brand text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 shadow-navy"
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {playing ? "일시정지" : "자동 재생"}
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % clips.length)}
            className="h-9 px-3 rounded-xl border border-border bg-card text-xs font-medium inline-flex items-center gap-1.5"
          >
            다음 클립
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center">
          브라우저 프리뷰입니다. 실제 mp4 합성은 다운받은 에셋을 CapCut/Premiere/원본 MoneyPrinterTurbo 로컬 실행으로
          연결하세요.
        </p>
      </div>

      {/* Clip list */}
      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
        {clips.map((c, i) => (
          <button
            key={`${c.id}-${i}`}
            onClick={() => setIdx(i)}
            className={`w-full text-left p-2 rounded-xl border transition flex gap-2 ${
              i === idx ? "border-primary/40 bg-primary/[0.06]" : "border-border bg-card hover:bg-secondary"
            }`}
          >
            <img src={c.thumbnail} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-mono text-muted-foreground truncate">{c.term}</div>
              <div className="text-xs font-medium">
                {c.width}×{c.height} · {c.durationSec}s
              </div>
              <div className="text-[10px] text-muted-foreground truncate">📷 {c.photographer}</div>
              <a
                href={c.pexelsUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] inline-flex items-center gap-0.5 text-primary mt-0.5"
              >
                Pexels <ExternalLink className="size-2.5" />
              </a>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Download helpers ---------------- */

function downloadJsonBundle(payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  triggerDownload(blob, `reels-bundle-${Date.now()}.json`);
}

function downloadScriptTxt(subject: string, script: string) {
  const blob = new Blob([`# ${subject}\n\n${script}\n`], { type: "text/plain;charset=utf-8" });
  triggerDownload(blob, `reels-script-${Date.now()}.txt`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
