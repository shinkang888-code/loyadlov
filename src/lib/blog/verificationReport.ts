// filepath: src/lib/blog/verificationReport.ts
/**
 * 추가요청 AI 검수 + 검수 리포트/전후 비교 텍스트.
 * 원본: daf-review-brief-studio/electron/lib/paid-features.cjs.
 */
import type {
  NormalizedCampaign,
  NormalizedPost,
  RequestResult,
  VerificationResult,
} from "./types";

const ADDITIONAL_REQUEST_POST_BODY_MAX_CHARS = 1300;

function cleanLine(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(value: unknown, limit: number): string {
  const text = String(value ?? "").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function formatValue(value: unknown): string {
  return typeof value === "boolean" ? (value ? "있음" : "없음") : String(value ?? "");
}

export function splitAdditionalRequests(value: unknown): string[] {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n|[;；]/)
    .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function buildAdditionalRequestReviewPrompt(
  campaign: { additionalRequests?: string } = {},
  post: NormalizedPost = {},
): string {
  const requests = splitAdditionalRequests(campaign.additionalRequests);
  const body = clip(
    post.bodyText || post.extractedBody || "",
    ADDITIONAL_REQUEST_POST_BODY_MAX_CHARS,
  );
  const title = clip(post.title || "", 240);
  return [
    "역할: 블로그 캠페인 게시글 검수자",
    "목표: 기타 요청사항이 게시글 본문에 반영됐는지 확인한다.",
    "",
    "판정 규칙:",
    "1. 게시글 본문에서 확인 가능한 내용만 근거로 판단한다.",
    "2. 애매하면 maybe_missing 또는 needs_review를 사용한다.",
    "3. 없는 내용을 있다고 추정하지 않는다.",
    "4. JSON 배열만 출력한다. 설명 문장, 코드블록, 표는 쓰지 않는다.",
    "",
    "허용 status: passed, maybe_missing, missing, needs_review",
    "",
    "[요청사항]",
    ...requests.map((r, i) => `${i + 1}. ${r}`),
    "",
    "[게시글 제목]",
    title || "없음",
    "",
    "[게시글 본문]",
    body || "없음",
    "",
    "출력 형식:",
    '[{"request":"요청사항 원문","status":"passed|maybe_missing|missing|needs_review","reason":"짧은 근거"}]',
  ].join("\n");
}

function extractBetween(text: string, open: string, close: string): string {
  const start = text.indexOf(open);
  const end = text.lastIndexOf(close);
  return start >= 0 && end > start ? text.slice(start, end + 1) : "";
}

function parseJsonLike(value: unknown): unknown {
  const text = String(value || "").trim();
  if (!text) return null;
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const candidates = [
    stripped,
    extractBetween(stripped, "[", "]"),
    extractBetween(stripped, "{", "}"),
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      /* try next */
    }
  }
  return null;
}

export function normalizeRequestStatus(value: unknown): RequestResult["status"] {
  const t = String(value || "")
    .trim()
    .toLowerCase();
  if (["passed", "pass", "ok", "반영", "반영됨"].includes(t)) return "passed";
  if (["missing", "fail", "누락", "미반영"].includes(t)) return "missing";
  if (["maybe_missing", "maybe", "partial", "부분", "애매"].includes(t)) return "maybe_missing";
  return "needs_review";
}

export function parseAdditionalRequestReviewResponse(
  aiText: unknown,
  requestsInput: string[] | string,
): RequestResult[] {
  const requests = Array.isArray(requestsInput)
    ? requestsInput
    : splitAdditionalRequests(requestsInput);
  if (!requests.length) return [];
  const parsed = parseJsonLike(aiText) as
    | unknown[]
    | { requestResults?: unknown[]; results?: unknown[] }
    | null;
  const items: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.requestResults)
      ? parsed!.requestResults!
      : Array.isArray(parsed?.results)
        ? parsed!.results!
        : [];
  if (!items.length) {
    return requests.map((r) => ({
      request: r,
      status: "needs_review" as const,
      reason: "AI 응답을 안정적으로 읽지 못해 직접 확인이 필요합니다.",
    }));
  }
  return requests.map((r, i) => {
    const raw = (items[i] ||
      items.find(
        (it) =>
          cleanLine((it as { request?: string; label?: string; text?: string })?.request) ===
          cleanLine(r),
      ) ||
      {}) as { status?: unknown; reason?: unknown; note?: unknown; evidence?: unknown };
    return {
      request: r,
      status: normalizeRequestStatus(raw.status),
      reason: cleanLine(raw.reason || raw.note || raw.evidence || ""),
    };
  });
}

export function requestStatusLabel(value: unknown): string {
  const t = String(value || "");
  if (t === "passed") return "반영됨";
  if (t === "missing") return "누락";
  if (t === "maybe_missing") return "누락 가능성";
  return "확인 필요";
}

function formatDateTime(value: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return String(value || "");
  }
}

export function buildVerificationReport(input: {
  campaign?: Partial<NormalizedCampaign>;
  verification?: Partial<VerificationResult>;
  normalizedPost?: NormalizedPost;
  createdAt?: string;
}): string {
  const campaign = input.campaign || {};
  const verification = input.verification || {};
  const post = input.normalizedPost || {};
  const lines = [
    "DAF 게시물 검수 리포트",
    "",
    `생성 시각: ${formatDateTime(input.createdAt || new Date().toISOString())}`,
    `캠페인 주제: ${campaign.subjectValue || "미입력"}`,
  ];
  if (post.title) lines.push(`게시글 제목: ${post.title}`);
  if (post.sourceUrl) lines.push(`게시글 URL: ${post.sourceUrl}`);
  lines.push("");
  lines.push("[전체 결과] " + (verification.passed ? "통과" : "확인 필요"));
  lines.push(
    `본문 글자수: ${verification.body?.charsNoSpaces || 0} / ${verification.body?.required || 0}`,
  );
  lines.push("");
  lines.push("[키워드]");
  const keywords = verification.keywords || [];
  if (keywords.length) {
    keywords.forEach((k) =>
      lines.push(`- ${k.keyword}: ${k.count}/${k.required}회 ${k.passed ? "통과" : "부족"}`),
    );
  } else {
    lines.push("- 키워드 없음");
  }
  lines.push("");
  lines.push("[미디어/지도]");
  const mediaChecks = (verification.media?.checks || []).filter((c) => c.enabled);
  if (mediaChecks.length) {
    mediaChecks.forEach((c) =>
      lines.push(
        `- ${c.label}: ${formatValue(c.actual)} / ${formatValue(c.required)} ${c.passed ? "통과" : "확인 필요"}`,
      ),
    );
  } else {
    lines.push("- 활성 조건 없음");
  }
  const requestResults = verification.requestResults || [];
  if (requestResults.length) {
    lines.push("");
    lines.push("[기타 요청사항 AI 체크]");
    requestResults.forEach((r) =>
      lines.push(
        `- ${r.request || "요청사항"}: ${requestStatusLabel(r.status)}${r.reason ? ` (${r.reason})` : ""}`,
      ),
    );
  }
  return lines.join("\n").trim();
}

export function summarizeVerification(
  campaign: Partial<NormalizedCampaign> = {},
  post: NormalizedPost = {},
  verification: Partial<VerificationResult> = {},
): {
  subject: string;
  title: string;
  sourceUrl: string;
  passed: boolean;
  failureCount: number;
  bodyChars: number;
  keywordCount: number;
} {
  const failing = [
    ...(verification.keywords || []).filter((k) => !k.passed),
    ...(verification.media?.checks || []).filter((c) => c.enabled && !c.passed),
    ...(verification.requestResults || []).filter((r) =>
      ["missing", "maybe_missing", "needs_review"].includes(String(r.status || "")),
    ),
  ] as unknown[];
  if (verification.body && !verification.body.passed) failing.unshift({ id: "body_length" });
  return {
    subject: campaign.subjectValue || "",
    title: post.title || "",
    sourceUrl: post.sourceUrl || "",
    passed: Boolean(verification.passed),
    failureCount: failing.length,
    bodyChars: verification.body?.charsNoSpaces || 0,
    keywordCount: (verification.keywords || []).length,
  };
}
