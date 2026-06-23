// filepath: src/components/BlogComposerPanel.tsx
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { enqueueBlogDraftFn, verifyBlogPostFn } from "@/lib/blog.functions";
import { listGenerationJobsFn } from "@/lib/generation.functions";
import { WRITER_STYLE_NAMES } from "@/lib/blog/draftAi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  PenLine,
  Sparkles,
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
} from "lucide-react";

type Props = {
  storeCode?: string;
  storeName: string;
  defaultKeyword?: string;
};

type KeywordReport = { keyword: string; count: number; required: number; passed: boolean };

type DraftResult = {
  title: string;
  body: string;
  writer?: string;
  metrics?: {
    bodyCharsNoSpaces: number;
    bodyTarget: number;
    bodyPassed: boolean;
    keywordReport: KeywordReport[];
  };
};

function copyText(text: string, label = "복사했습니다") {
  navigator.clipboard?.writeText(text).then(
    () => toast.success(label),
    () => toast.error("복사 실패"),
  );
}

export function BlogComposerPanel({ storeCode, storeName, defaultKeyword }: Props) {
  const enqueue = useServerFn(enqueueBlogDraftFn);
  const listJobs = useServerFn(listGenerationJobsFn);
  const verify = useServerFn(verifyBlogPostFn);

  // --- 생성 폼 ---
  const [subject, setSubject] = useState(defaultKeyword || `${storeName} 방문 후기`);
  const [keywords, setKeywords] = useState(storeName);
  const [requiredCount, setRequiredCount] = useState(3);
  const [bodyMin, setBodyMin] = useState(1000);
  const [writer, setWriter] = useState("기본 작가");
  const [additional, setAdditional] = useState("");
  const [imageMin, setImageMin] = useState(5);
  const [videoRequired, setVideoRequired] = useState(false);
  const [mapRequired, setMapRequired] = useState(true);
  const [saveBrief, setSaveBrief] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function buildCampaignPayload() {
    return {
      storeCode,
      subjectValue: subject.trim(),
      keywords,
      keywordRequiredCount: requiredCount,
      bodyMinCharsNoSpaces: bodyMin,
      additionalRequests: additional,
      writer,
      imageMinCount: imageMin,
      videoRequired,
      mapRequired,
    };
  }

  async function generate() {
    if (!subject.trim()) {
      toast.error("주제를 입력해 주세요.");
      return;
    }
    setGenerating(true);
    setDraft(null);
    try {
      const { jobId } = await enqueue({ data: { ...buildCampaignPayload(), saveBrief } });
      toast.success("원고 생성 작업을 큐에 등록했습니다", {
        description: "AI가 장문 원고를 작성 중입니다…",
      });

      let attempts = 0;
      pollRef.current = setInterval(() => {
        void (async () => {
          attempts += 1;
          if (attempts > 40) {
            if (pollRef.current) clearInterval(pollRef.current);
            setGenerating(false);
            toast.error("원고 생성이 지연되고 있습니다. 작업 큐에서 확인해 주세요.");
            return;
          }
          try {
            const { jobs } = await listJobs({ data: { storeCode, limit: 10 } });
            const job = jobs.find((j) => j.id === jobId);
            if (!job) return;
            if (job.status === "completed") {
              if (pollRef.current) clearInterval(pollRef.current);
              setGenerating(false);
              const r = job.result as unknown as DraftResult | null;
              if (r?.body) {
                setDraft(r);
                toast.success("원고가 완성되었습니다.");
              }
            } else if (job.status === "failed") {
              if (pollRef.current) clearInterval(pollRef.current);
              setGenerating(false);
              toast.error(job.errorMessage || "원고 생성에 실패했습니다.");
            }
          } catch {
            /* 다음 폴링에서 재시도 */
          }
        })();
      }, 2500);
    } catch (e) {
      setGenerating(false);
      toast.error(e instanceof Error ? e.message : "등록 실패");
    }
  }

  // --- 검수 ---
  const [postBody, setPostBody] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [imageCount, setImageCount] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [report, setReport] = useState<{
    passed: boolean;
    reportText: string;
    revisionText: string;
    keywords: KeywordReport[];
    body: { charsNoSpaces: number; required: number; passed: boolean };
  } | null>(null);

  async function runVerify() {
    if (!postBody.trim()) {
      toast.error("검수할 발행 본문을 붙여넣어 주세요.");
      return;
    }
    setVerifying(true);
    try {
      const res = await verify({
        data: {
          ...buildCampaignPayload(),
          postBody,
          sourceUrl: sourceUrl || undefined,
          imageCount,
        },
      });
      setReport({
        passed: res.passed,
        reportText: res.reportText,
        revisionText: res.revisionText,
        keywords: res.keywords,
        body: res.body,
      });
      toast[res.passed ? "success" : "warning"](
        res.passed ? "검수 통과" : "보완 필요 항목이 있습니다.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "검수 실패");
    } finally {
      setVerifying(false);
    }
  }

  function useDraftForVerify() {
    if (draft?.body) {
      setPostBody(draft.body);
      toast.success("생성 원고를 검수 입력에 채웠습니다.");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* 생성 */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <header className="flex items-center gap-2">
          <PenLine className="size-5 text-crimson" />
          <h3 className="font-display font-bold text-lg">네이버 블로그 원고 생성</h3>
        </header>
        <p className="text-xs text-muted-foreground -mt-2">
          캠페인 조건을 입력하면 AI가 제목·도입부·소제목 4개·마치며로 구성된 장문 원고를 작성합니다.
          결과는 초안(content_drafts, 채널=네이버)으로도 저장됩니다.
        </p>

        <div className="grid gap-1.5">
          <Label htmlFor="blog-subject">주제 *</Label>
          <Input
            id="blog-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="예: 미나리삼겹살 신메뉴 방문 후기"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="blog-keywords">키워드 (쉼표 구분)</Label>
          <Input
            id="blog-keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="예: 강남맛집, 삼겹살, 회식장소"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="blog-required">키워드 반복</Label>
            <Input
              id="blog-required"
              type="number"
              min={1}
              max={30}
              value={requiredCount}
              onChange={(e) => setRequiredCount(Math.max(1, Number(e.target.value) || 3))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="blog-bodymin">본문 최소(공백제외)</Label>
            <Input
              id="blog-bodymin"
              type="number"
              min={0}
              max={100000}
              value={bodyMin}
              onChange={(e) => setBodyMin(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="blog-image">이미지 최소</Label>
            <Input
              id="blog-image"
              type="number"
              min={0}
              max={200}
              value={imageMin}
              onChange={(e) => setImageMin(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label>작가 스타일</Label>
          <Select value={writer} onValueChange={setWriter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WRITER_STYLE_NAMES.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="blog-additional">추가 요청사항</Label>
          <Textarea
            id="blog-additional"
            rows={2}
            value={additional}
            onChange={(e) => setAdditional(e.target.value)}
            placeholder="예: 주차 가능 여부 언급, 매장 분위기 강조"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={videoRequired} onCheckedChange={setVideoRequired} /> 동영상 필수
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={mapRequired} onCheckedChange={setMapRequired} /> 지도 필수
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={saveBrief} onCheckedChange={setSaveBrief} /> 브리프 저장
          </label>
        </div>

        <Button onClick={() => void generate()} disabled={generating} className="w-full">
          {generating ? (
            <Loader2 className="size-4 animate-spin mr-1.5" />
          ) : (
            <Sparkles className="size-4 mr-1.5" />
          )}
          {generating ? "원고 작성 중…" : "AI 원고 생성"}
        </Button>

        {draft && (
          <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold text-sm truncate">{draft.title}</h4>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyText(`${draft.title}\n\n${draft.body}`)}
                >
                  <Copy className="size-3.5 mr-1" /> 복사
                </Button>
                <Button size="sm" variant="outline" onClick={useDraftForVerify}>
                  검수로
                </Button>
              </div>
            </div>
            {draft.metrics && (
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span
                  className={`px-2 py-0.5 rounded-md border ${
                    draft.metrics.bodyPassed
                      ? "border-emerald-500/40 text-emerald-600"
                      : "border-amber-500/40 text-amber-600"
                  }`}
                >
                  본문 {draft.metrics.bodyCharsNoSpaces}/{draft.metrics.bodyTarget}자
                </span>
                {draft.metrics.keywordReport.map((k) => (
                  <span
                    key={k.keyword}
                    className={`px-2 py-0.5 rounded-md border ${
                      k.passed
                        ? "border-emerald-500/40 text-emerald-600"
                        : "border-amber-500/40 text-amber-600"
                    }`}
                  >
                    {k.keyword} {k.count}/{k.required}
                  </span>
                ))}
              </div>
            )}
            <pre className="whitespace-pre-wrap text-xs leading-relaxed max-h-72 overflow-y-auto font-sans">
              {draft.body}
            </pre>
          </div>
        )}
      </section>

      {/* 검수 */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <header className="flex items-center gap-2">
          <ClipboardCheck className="size-5 text-primary" />
          <h3 className="font-display font-bold text-lg">발행 후 검수 / 수정요청</h3>
        </header>
        <p className="text-xs text-muted-foreground -mt-2">
          발행된 본문을 붙여넣으면 캠페인 조건(본문 길이·키워드 횟수·미디어) 충족 여부를 검사하고,
          블로거에게 보낼 수정요청 문구를 생성합니다.
        </p>

        <div className="grid gap-1.5">
          <Label htmlFor="verify-url">발행 글 URL (선택)</Label>
          <Input
            id="verify-url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://blog.naver.com/아이디/글번호"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="verify-body">발행 본문 *</Label>
          <Textarea
            id="verify-body"
            rows={8}
            value={postBody}
            onChange={(e) => setPostBody(e.target.value)}
            placeholder="네이버 블로그에 발행된 본문 텍스트를 붙여넣으세요."
          />
        </div>

        <div className="grid gap-1.5 w-40">
          <Label htmlFor="verify-image">이미지 개수</Label>
          <Input
            id="verify-image"
            type="number"
            min={0}
            value={imageCount}
            onChange={(e) => setImageCount(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>

        <Button
          onClick={() => void runVerify()}
          disabled={verifying}
          variant="secondary"
          className="w-full"
        >
          {verifying ? (
            <Loader2 className="size-4 animate-spin mr-1.5" />
          ) : (
            <ClipboardCheck className="size-4 mr-1.5" />
          )}
          {verifying ? "검수 중…" : "조건 충족 검수"}
        </Button>

        {report && (
          <div className="space-y-3">
            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
                report.passed
                  ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/5"
                  : "border-amber-500/40 text-amber-600 bg-amber-500/5"
              }`}
            >
              {report.passed ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <AlertCircle className="size-4" />
              )}
              {report.passed ? "모든 조건 충족" : "보완 필요"}
              <span className="ml-auto text-[11px] font-normal text-muted-foreground">
                본문 {report.body.charsNoSpaces}/{report.body.required}자
              </span>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px]">
              {report.keywords.map((k) => (
                <span
                  key={k.keyword}
                  className={`px-2 py-0.5 rounded-md border ${
                    k.passed
                      ? "border-emerald-500/40 text-emerald-600"
                      : "border-amber-500/40 text-amber-600"
                  }`}
                >
                  {k.keyword} {k.count}/{k.required}
                </span>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-secondary/40 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold">블로거 수정요청 문구</span>
                <Button size="sm" variant="outline" onClick={() => copyText(report.revisionText)}>
                  <Copy className="size-3.5 mr-1" /> 복사
                </Button>
              </div>
              <pre className="whitespace-pre-wrap text-xs leading-relaxed max-h-56 overflow-y-auto font-sans">
                {report.revisionText}
              </pre>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
