// filepath: src/lib/blog/draftAi.ts
/**
 * 블로그 원고 AI 프롬프트 빌더 + 견고한 응답 파서/검증/폴백.
 * 원본: daf-review-brief-studio/electron/lib/draft-ai.cjs.
 * 데스크톱판은 Google AI Mode 스크래핑 결과를 파싱했으나, loyadbeta 는 Lovable Gateway 정식 응답을 파싱한다.
 * (스크래핑 노이즈 제거 로직은 방어적으로 유지)
 */
import type { DraftOptions, DraftValidation, NormalizedCampaign, ParsedDraft } from "./types";

type WriterGuide = { prompt: string; fallbackLine: string };

const WRITER_STYLE_GUIDES = new Map<string, WriterGuide>([
  [
    "기본 작가",
    {
      prompt: "친근한 존댓말 블로그 문체, 설명과 소회를 균형 있게 섞습니다.",
      fallbackLine:
        "정보와 느낌을 균형 있게 배치해 처음 읽는 사람도 편하게 따라올 수 있도록 정리합니다.",
    },
  ],
  [
    "정보형 칼럼",
    {
      prompt: "정보형 칼럼처럼 배경, 기준, 체크 포인트, 주의점을 차분하게 정리합니다.",
      fallbackLine: "배경과 판단 기준을 먼저 세우고, 확인할 점과 주의할 점을 차분하게 나눕니다.",
    },
  ],
  [
    "친근한 리뷰",
    {
      prompt:
        "친근한 리뷰처럼 자연스러운 생활 말투를 쓰고, 독자가 실제 상황을 상상할 수 있는 체감 포인트를 넣습니다.",
      fallbackLine: "실제로 고르거나 방문하기 전 떠올릴 만한 장면을 부드럽게 풀어냅니다.",
    },
  ],
  [
    "체크리스트형",
    {
      prompt: "체크리스트형 글처럼 소제목마다 확인 항목과 판단 기준을 분명히 제시합니다.",
      fallbackLine: "바로 확인할 항목을 짧게 나누고, 선택 기준이 한눈에 보이도록 구성합니다.",
    },
  ],
  [
    "경험담 중심",
    {
      prompt: "직접 경험을 정리하는 리뷰처럼 상황, 선택 이유, 느낀 점을 자연스럽게 연결합니다.",
      fallbackLine: "독자가 실제 상황을 떠올릴 수 있도록 맥락과 체감 포인트를 함께 정리합니다.",
    },
  ],
  [
    "전문가 톤",
    {
      prompt: "전문가가 설명하듯 차분하고 신뢰감 있게 쓰며, 기준, 비교, 주의점을 명확히 나눕니다.",
      fallbackLine: "판단 기준과 확인 포인트를 명료하게 세워 신뢰감 있는 흐름으로 정리합니다.",
    },
  ],
  [
    "검색 최적화형",
    {
      prompt:
        "검색 유입을 고려해 핵심 키워드를 자연스럽게 반복하고, 독자가 궁금해할 질문에 순서대로 답합니다.",
      fallbackLine: "검색 의도와 핵심 키워드가 자연스럽게 이어지도록 문단 흐름을 구성합니다.",
    },
  ],
  [
    "감성 리뷰형",
    {
      prompt: "감성적인 리뷰처럼 분위기와 인상을 부드럽게 풀어냅니다.",
      fallbackLine: "정보만 나열하지 않고 분위기와 인상을 함께 담아 읽기 편한 흐름을 만듭니다.",
    },
  ],
  [
    "비교 분석형",
    {
      prompt: "비교 분석형 글처럼 선택 기준, 장단점, 추천 상황을 균형 있게 정리합니다.",
      fallbackLine: "좋은 점과 확인할 점을 함께 배치해 독자가 스스로 판단할 수 있게 돕습니다.",
    },
  ],
  [
    "초보자 설명형",
    {
      prompt:
        "처음 접하는 독자도 이해할 수 있게 쉬운 말로 배경, 용어, 확인 순서를 풀어 설명합니다.",
      fallbackLine: "처음 보는 사람도 따라올 수 있도록 기본 개념부터 차근차근 정리합니다.",
    },
  ],
]);

export const WRITER_STYLE_NAMES = Array.from(WRITER_STYLE_GUIDES.keys());

export function writerStyle(value: unknown): string {
  const v = String(value ?? "기본 작가").trim();
  return WRITER_STYLE_GUIDES.has(v) ? v : "기본 작가";
}

function clip(value: unknown, limit: number): string {
  const text = String(value ?? "").trim();
  return text.length <= limit ? text : `${text.slice(0, limit)}...`;
}

function currentKstDate(): string {
  const now = new Date();
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replace(/\.\s?/g, "-")
    .replace(/-$/, "");
}

function cleanSingleLine(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanBody(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanTitle(value: unknown): string {
  return cleanSingleLine(value)
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/^제목\s*[:：]\s*/, "")
    .replace(/^["“”']+|["“”']+$/g, "")
    .trim();
}

function keywordPromptLines(input: Partial<NormalizedCampaign> = {}): string[] {
  const keywords = Array.isArray(input.keywords)
    ? input.keywords.map(cleanSingleLine).filter(Boolean)
    : [];
  const required = Math.max(1, Number(input.keywordRequiredCount || 3));
  return keywords.length
    ? keywords.map((k) => `- ${k}: 본문에 최소 ${required}회, 문맥 안에서 자연스럽게 사용`)
    : ["- 키워드 없음"];
}

export function buildReviewDraftPrompt(
  input: Partial<NormalizedCampaign> = {},
  opts: DraftOptions = {},
): string {
  const style = writerStyle(
    input ? (input as { writer?: string }).writer || opts.writer : opts.writer,
  );
  const guide = WRITER_STYLE_GUIDES.get(style) || WRITER_STYLE_GUIDES.get("기본 작가")!;
  const subject = clip(input.subjectValue || "미입력", 300);
  const bodyMin = Number(input.bodyMinCharsNoSpaces || 1000);
  const keywordLines = keywordPromptLines(input);
  return [
    `기준일: ${currentKstDate()}`,
    "채널: 네이버 블로그",
    `주제: ${subject}`,
    `작가 스타일: ${style}`,
    `작가 스타일 지시: ${guide.prompt}`,
    "",
    "캠페인 조건:",
    `- 주제값을 중심으로 원고를 작성한다: ${subject}`,
    `- 목표 본문 글자수: 공백 제외 최소 ${bodyMin}자`,
    "",
    "키워드 조건:",
    ...keywordLines,
    "",
    "추가 요청사항:",
    clip(input.additionalRequests || "없음", 1800),
    "",
    "작성 규칙:",
    "1. 네이버 블로그에 바로 붙여 넣을 수 있는 한국어 원고만 출력한다.",
    "2. 입력된 주제값의 유형을 별도로 분기하지 말고, 주제값과 제공된 조건만 근거로 작성한다.",
    "3. 주제값의 원문 표기는 임의로 고치지 않는다.",
    "4. 키워드는 문맥 안에 자연스럽게 넣고 억지 반복 문장을 만들지 않는다.",
    "5. URL, 표, 코드블록, JSON, 이미지, 링크, 후속 질문을 쓰지 않는다.",
    "6. 텍스트 원고만 출력한다.",
    "",
    "출력 구조:",
    "- 첫 줄은 제목만 쓴다.",
    "- 다음 줄부터 도입부 1문단을 쓴다.",
    "- 그 뒤 일반 텍스트 소제목 4개와 마지막 소제목 `마치며` 순서로 쓴다.",
    "- 마크다운 기호(`#`, `##`, `**`)에 의존하지 말고 본문 구조를 일반 텍스트 줄로 구분한다.",
    "- 제목은 32자 이하 우선, 필요하면 46자까지 허용한다.",
    "- 마지막 소제목 `마치며`는 상담형 문구가 아니라 자연스러운 소회와 정리로 닫는다.",
    "",
    "[반복 방지 키워드]",
    "이번 글에서 다룬 핵심 주제어 5~10개를 쉼표로만 나열",
  ].join("\n");
}

export function buildReviewDraftRepairPrompt(
  input: Partial<NormalizedCampaign> = {},
  opts: DraftOptions = {},
): string {
  const style = writerStyle(
    input ? (input as { writer?: string }).writer || opts.writer : opts.writer,
  );
  const subject = clip(input.subjectValue || "앞선 요청의 주제", 160);
  return [
    "방금 답변은 네이버 블로그 원고가 아니었습니다. 아래 조건만 지켜 다시 작성하세요.",
    `기준일: ${currentKstDate()}`,
    `주제: ${subject}`,
    `작가 스타일: ${style}`,
    "",
    "필수 조건:",
    "- 한국어 네이버 블로그 원고만 출력",
    "- 첫 줄은 제목",
    "- 도입부 1문단 뒤에 일반 텍스트 소제목 4개와 마지막 소제목 `마치며` 작성",
    "- 본문은 700자 이상",
    "- URL, 표, 코드블록, JSON, 이미지, 링크, 후속 질문 금지",
    "- 답변 불가, 검색 불가, 다른 질문 요청 같은 거절 문구 금지",
    "- 입력 조건에 없는 출처없는 정보는 만들지 말 것",
    "",
    "지금 바로 원고 본문만 출력하세요.",
  ].join("\n");
}

/* ---------- 파서 ---------- */

function stripCodeFence(value: unknown): string {
  return String(value ?? "")
    .replace(/^```(?:json|markdown|md)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonObject(value: unknown): string {
  const text = String(value ?? "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start < 0 || end <= start ? "" : text.slice(start, end + 1);
}

function normalizedLines(value: unknown, opts: { keepBlank?: boolean } = {}): string[] {
  const keepBlank = Boolean(opts.keepBlank);
  const lines = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim());
  return keepBlank ? lines : lines.filter(Boolean);
}

function firstContentLine(value: unknown): string {
  return normalizedLines(value).find((l) => !/^\[.+\]$/.test(l)) || "";
}

function extractTrailingKeywordLine(value: unknown): { body: string; keywords: string } {
  const lines = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  let lastIdx = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].trim()) {
      lastIdx = i;
      break;
    }
  }
  if (lastIdx < 0) return { body: String(value ?? "").trim(), keywords: "" };
  const last = lines[lastIdx].trim();
  if (
    (last.match(/,/g) || []).length >= 3 &&
    last.length <= 260 &&
    !/[.!?。！？]$/.test(last) &&
    !/^https?:\/\//i.test(last)
  ) {
    lines.splice(lastIdx, 1);
    return { body: lines.join("\n").trim(), keywords: last };
  }
  return { body: String(value ?? "").trim(), keywords: "" };
}

type ParserResult = { source: string; title: string; body: string; checklist: string[] } | null;

function parseJsonDraft(text: string): ParserResult {
  const json = extractJsonObject(text);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const title = cleanSingleLine(
      parsed?.title || parsed?.["제목"] || parsed?.blogTitle || parsed?.headline || "",
    );
    const body = cleanBody(
      parsed?.body ||
        parsed?.["본문"] ||
        parsed?.draft ||
        parsed?.["원고"] ||
        parsed?.content ||
        parsed?.article ||
        "",
    );
    const checklist = Array.isArray(parsed?.checklist)
      ? (parsed.checklist as unknown[]).map(cleanSingleLine).filter(Boolean)
      : Array.isArray(parsed?.["체크리스트"])
        ? (parsed["체크리스트"] as unknown[]).map(cleanSingleLine).filter(Boolean)
        : [];
    return title && body ? { source: "json", title, body, checklist } : null;
  } catch {
    return null;
  }
}

function parseMarkdownDraft(text: string): ParserResult {
  const lines = normalizedLines(text, { keepBlank: true });
  const idx = lines.findIndex((l) => /^#{1,2}\s+\S/.test(l.trim()));
  if (idx < 0) return null;
  const title = cleanTitle(lines[idx].replace(/^#{1,2}\s+/, ""));
  let body = lines
    .slice(idx + 1)
    .join("\n")
    .trim();
  body = cleanBody(extractTrailingKeywordLine(body).body);
  return title && body ? { source: "markdown", title, body, checklist: [] } : null;
}

function parseMarkerDraft(text: string): ParserResult {
  const t = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  const titleMatch = t.match(/\[\s*제목\s*\]\s*([\s\S]*?)(?=\n\s*\[\s*본문\s*\]|$)/i);
  const bodyMatch = t.match(
    /\[\s*본문\s*\]\s*([\s\S]*?)(?=\n\s*\[\s*(?:체크리스트|반복 방지 키워드|키워드|이미지|참고)\s*\]|$)/i,
  );
  if (!titleMatch || !bodyMatch) return null;
  const title = cleanTitle(firstContentLine(titleMatch[1]));
  let body = cleanBody(bodyMatch[1]);
  const trailing = extractTrailingKeywordLine(body);
  body = cleanBody(trailing.body);
  return title && body
    ? {
        source: "markers",
        title,
        body,
        checklist: trailing.keywords ? [`반복 방지 키워드: ${trailing.keywords}`] : [],
      }
    : null;
}

function sectionResult(titleRaw: string, bodyRaw: string, source: string): ParserResult {
  const title = cleanTitle(titleRaw);
  let body = cleanBody(bodyRaw)
    .replace(/(?:^|\n)\s*(?:checklist|체크리스트|반복 방지 키워드)\s*[:：]?[\s\S]*$/i, "")
    .trim();
  body = cleanBody(extractTrailingKeywordLine(body).body);
  return title && body ? { source, title, body, checklist: [] } : null;
}

function parseSectionDraft(text: string): ParserResult {
  const t = String(text ?? "").trim();
  const combined = t.match(
    /(?:^|\n|\s)(?:title|제목)\s*[:：]\s*(.+?)\s+(?:body|본문|원고)\s*[:：]\s*([\s\S]+)$/i,
  );
  if (combined) return sectionResult(combined[1], combined[2], "sections");
  const titleMatch =
    t.match(/(?:^|\n)\s*(?:title|제목)\s*[:：]\s*(.+?)(?=\n|$)/i) ||
    t.match(/["“]?title["”]?\s*[:：]\s*["“]?(.+?)["”]?\s*(?:,|\n|$)/i);
  const bodyMatch =
    t.match(/(?:^|\n)\s*(?:body|본문|원고)\s*[:：]\s*([\s\S]+)$/i) ||
    t.match(/["“]?body["”]?\s*[:：]\s*["“]?([\s\S]+?)["”]?\s*(?:\n\s*["“]?\w+["”]?\s*[:：]|$)/i);
  return titleMatch && bodyMatch ? sectionResult(titleMatch[1], bodyMatch[1], "sections") : null;
}

function looksLikeUiNoise(value: unknown): boolean {
  const t = cleanSingleLine(value);
  return (
    !t ||
    /^(Google|AI Mode|AI 모드|검색|이미지|동영상|지도|뉴스|쇼핑|로그인|공유|더보기|내보내기)$/i.test(
      t,
    )
  );
}

function parsePlainDraft(text: string): ParserResult {
  const lines = normalizedLines(removePromptEchoLines(text))
    .filter((l) => !looksLikeUiNoise(l))
    .filter((l) => !/^\[반복 방지 키워드\]/.test(l));
  if (lines.length < 2) return null;
  const titleIdx = lines.findIndex((l) => {
    const t = cleanTitle(l);
    return t.length >= 4 && t.length <= 70 && !/[.!?。！？]$/.test(t);
  });
  const idx = titleIdx >= 0 ? titleIdx : 0;
  const title = cleanTitle(lines[idx]);
  let body = lines
    .filter((_, i) => i !== idx)
    .join("\n")
    .trim();
  const trailing = extractTrailingKeywordLine(body);
  body = cleanBody(trailing.body);
  return title && body
    ? {
        source: "plain_text",
        title,
        body,
        checklist: trailing.keywords ? [`반복 방지 키워드: ${trailing.keywords}`] : [],
      }
    : null;
}

export function looksLikePromptEcho(value: unknown): boolean {
  const t = cleanSingleLine(value);
  return (
    [
      "채널: 네이버 블로그",
      "캠페인 조건:",
      "키워드 조건:",
      "작성 규칙:",
      "출력 구조:",
      "첫 줄은 제목",
      "URL, 표, 코드블록, JSON",
      "이번 글에서 다룬 핵심",
    ].filter((needle) => t.includes(needle)).length >= 3
  );
}

export function looksLikeAiDraftFailure(value: unknown): boolean {
  const t = cleanSingleLine(value).toLowerCase();
  if (!t) return true;
  if (/^\s*사이트\s+\d+개/.test(cleanSingleLine(value))) return true;
  const needles = [
    "something went wrong and the content wasn't generated",
    "content wasn't generated",
    "couldn't generate",
    "try again",
    "제공해 드릴 수 있는 대답이 없는 것 같습니다",
    "응답을 생성하지 못",
    "원고를 확인하지 못",
    "원고 내용을 입력창",
    "원고를 붙여",
    "다시 시도",
    "더 구체적으로 알려",
  ];
  if (needles.some((n) => t.includes(n.toLowerCase()))) return true;
  return looksLikePromptEcho(value);
}

function removePromptEchoLines(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => !looksLikePromptEcho(l))
    .join("\n")
    .trim();
}

function failedDraft(raw: string, reason: string): ParsedDraft {
  return {
    parsed: false,
    source: "none",
    title: "",
    body: "",
    checklist: [],
    rawResponse: raw,
    reason,
  };
}

export function parseReviewDraftResponse(value: unknown): ParsedDraft {
  const raw = String(value ?? "").trim();
  const cleaned = stripCodeFence(raw);
  if (looksLikeAiDraftFailure(cleaned)) return failedDraft(raw, "failure_text");
  const parsers = [
    () => parseJsonDraft(cleaned),
    () => parseMarkdownDraft(cleaned),
    () => parseMarkerDraft(cleaned),
    () => parseSectionDraft(cleaned),
    () => parsePlainDraft(cleaned),
  ];
  for (const parse of parsers) {
    const result = parse();
    if (result?.title && result?.body) {
      return { parsed: true, rawResponse: raw, ...result };
    }
  }
  return failedDraft(raw, raw ? "title_or_body_not_found" : "empty_response");
}

export function validateReviewDraft(
  draft: ParsedDraft,
  opts: { minBodyLength?: number } = {},
): DraftValidation {
  if (!draft?.parsed) return { ok: false, reason: draft?.reason || "not_parsed" };
  const title = cleanSingleLine(draft.title);
  const body = cleanBody(draft.body);
  const min = Math.max(120, Number(opts.minBodyLength || 180));
  if (title.length < 4) return { ok: false, reason: "title_too_short" };
  if (title.length > 90) return { ok: false, reason: "title_too_long" };
  if (body.length < min) return { ok: false, reason: `body_too_short:${body.length}` };
  if (looksLikeAiDraftFailure(body) || looksLikePromptEcho(body))
    return { ok: false, reason: "failure_or_prompt_echo" };
  return { ok: true, reason: "ok" };
}

export function pickParsableReviewDraft(
  candidates: string[] = [],
  opts: { minBodyLength?: number } = {},
): { rawDraft: string; parsed: ParsedDraft | null; reason?: string } {
  let reason = "not_parsable";
  for (const candidate of candidates) {
    const raw = String(candidate ?? "").trim();
    if (!raw) continue;
    const parsed = parseReviewDraftResponse(raw);
    const validation = validateReviewDraft(parsed, opts);
    reason = validation.reason;
    if (validation.ok) return { rawDraft: raw, parsed };
  }
  return { rawDraft: "", parsed: null, reason };
}

export function buildFallbackReviewDraft(
  input: Partial<NormalizedCampaign> = {},
  opts: DraftOptions & { subject?: string } = {},
): ParsedDraft {
  const subject = cleanSingleLine(input.subjectValue || opts.subject || "입력한 주제");
  const style = writerStyle((input as { writer?: string }).writer || opts.writer);
  const guide = WRITER_STYLE_GUIDES.get(style) || WRITER_STYLE_GUIDES.get("기본 작가")!;
  const keywords = Array.isArray(input.keywords)
    ? input.keywords.map(cleanSingleLine).filter(Boolean)
    : [];
  return {
    parsed: true,
    source: "local_fallback",
    rawResponse: "",
    title: cleanSingleLine(`${subject} 정리 전 확인할 점`),
    body: cleanBody(
      [
        `${subject}을 다룰 때는 먼저 독자가 왜 이 정보를 찾는지부터 정리하는 편이 좋습니다. ${
          keywords.length
            ? `핵심 키워드인 ${keywords.join(", ")}는 문맥 안에서 자연스럽게 배치합니다.`
            : "핵심 주제와 독자의 검색 의도가 자연스럽게 이어지도록 배치합니다."
        }`,
        guide.fallbackLine,
        `${subject} 관련 정보는 장점만 나열하기보다 확인해야 할 조건과 주의할 점을 함께 담아야 글의 신뢰도가 올라갑니다.`,
        "확인되지 않은 세부 정보는 단정하지 않고, 발행 전 공식 정보나 최신 자료로 보완할 수 있게 여지를 남깁니다.",
        `마치며\n${subject}에 대한 초안은 전체 흐름을 먼저 잡는 용도입니다. 실제 발행 전에는 최신 정보와 표현 수위를 확인해 자연스럽게 다듬으면 좋습니다.`,
      ].join("\n\n"),
    ),
    checklist: ["AI 원고 파싱 실패 시 로컬 초안 생성", "미디어 조건 제외"],
  };
}
