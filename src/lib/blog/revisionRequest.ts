// filepath: src/lib/blog/revisionRequest.ts
/**
 * 검수 결과 → 블로거 수정요청 메시지 생성 + AI 다듬기.
 * 원본: daf-review-brief-studio/electron/lib/revision-request.cjs.
 */
import type {
  NormalizedCampaign,
  NormalizedPost,
  RevisionIssue,
  RevisionResult,
  VerificationResult,
} from "./types";

type RevisionGuide = {
  prompt: string;
  intro: string;
  requestLine: string;
  closing: string;
  noIssue: string;
};

const REVISION_STYLE_GUIDES = new Map<string, RevisionGuide>([
  [
    "기본형",
    {
      prompt: "정중하고 간결한 업무 메시지로 다듬습니다.",
      intro: "안녕하세요. 게시글 검수 결과 공유드립니다.",
      requestLine: "아래 항목 보완을 부탁드립니다.",
      closing: "수정 완료 후 다시 확인할 수 있도록 알려주시면 재검수하겠습니다.",
      noIssue: "현재 입력된 캠페인 조건 기준으로는 큰 수정 요청 항목이 확인되지 않았습니다.",
    },
  ],
  [
    "체크리스트형",
    {
      prompt: "항목별 확인이 쉬운 체크리스트형 메시지로 다듬습니다.",
      intro: "안녕하세요. 게시글 검수 결과를 체크리스트로 정리드립니다.",
      requestLine: "아래 체크 항목 기준으로 보완 부탁드립니다.",
      closing: "각 항목 수정 후 알려주시면 동일 기준으로 다시 확인하겠습니다.",
      noIssue: "현재 체크리스트 기준으로는 주요 수정 요청 항목이 확인되지 않았습니다.",
    },
  ],
  [
    "부드러운 안내형",
    {
      prompt: "상대가 부담을 덜 느끼도록 부드럽고 협조적인 안내 톤으로 다듬습니다.",
      intro: "안녕하세요. 게시글 확인 후 조금만 보완하면 좋을 부분을 정리해드립니다.",
      requestLine: "가능하실 때 아래 내용 위주로 보완 부탁드립니다.",
      closing: "수정 후 편하게 알려주시면 다시 확인해드리겠습니다.",
      noIssue: "현재 조건 기준으로는 크게 보완을 요청드릴 부분이 확인되지 않았습니다.",
    },
  ],
  [
    "단호한 요청형",
    {
      prompt: "필수 조건 보완이 분명히 전달되도록 정중하지만 단호한 요청 톤으로 다듬습니다.",
      intro: "안녕하세요. 게시글 검수 결과 필수 보완 항목을 안내드립니다.",
      requestLine: "아래 항목은 캠페인 조건 충족을 위해 수정이 필요합니다.",
      closing: "수정 완료 후 재검수가 필요하니 완료 시점에 공유 부탁드립니다.",
      noIssue: "현재 필수 조건 기준으로는 추가 수정 요청 항목이 확인되지 않았습니다.",
    },
  ],
  [
    "클라이언트 보고형",
    {
      prompt: "브랜드 또는 대행사 내부 공유에 적합한 객관적인 보고 톤으로 다듬습니다.",
      intro: "게시글 검수 결과를 아래와 같이 정리합니다.",
      requestLine: "보완 필요 항목은 다음과 같습니다.",
      closing: "수정 완료 후 동일 기준으로 재검수 예정입니다.",
      noIssue: "현재 검수 기준으로는 주요 보완 요청 항목이 확인되지 않았습니다.",
    },
  ],
]);

export const REVISION_STYLE_NAMES = Array.from(REVISION_STYLE_GUIDES.keys());

function cleanLine(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function positiveNumber(value: unknown): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatValue(value: unknown): string {
  return typeof value === "boolean" ? (value ? "있음" : "없음") : `${positiveNumber(value)}`;
}

export function revisionStyle(value: unknown): string {
  const v = cleanLine(value || "기본형");
  return REVISION_STYLE_GUIDES.has(v) ? v : "기본형";
}

export function collectRevisionIssues(
  verification: Partial<VerificationResult> = {},
): RevisionIssue[] {
  const issues: RevisionIssue[] = [];
  const body = verification.body || ({} as VerificationResult["body"]);
  const required = positiveNumber(body.required);
  const chars = positiveNumber(body.charsNoSpaces);
  if (required > 0 && !body.passed) {
    const gap = Math.max(0, required - chars);
    issues.push({
      id: "body_length",
      severity: "required",
      message: `본문 공백 제외 글자수가 ${chars}자로 확인되어 기준 ${required}자보다 ${gap}자 부족합니다.`,
    });
  }
  const failingKeywords = (
    Array.isArray(verification.keywords) ? verification.keywords : []
  ).filter((k) => !k.passed);
  if (failingKeywords.length) {
    const detail = failingKeywords
      .map(
        (k) => `${cleanLine(k.keyword)} ${positiveNumber(k.count)}/${positiveNumber(k.required)}회`,
      )
      .join(", ");
    issues.push({
      id: "keyword_count",
      severity: "required",
      message: `키워드 반복 횟수가 부족합니다. (${detail})`,
    });
  }
  const mediaChecks = Array.isArray(verification.media?.checks) ? verification.media!.checks : [];
  for (const check of mediaChecks) {
    if (check.enabled && !check.passed) {
      issues.push({
        id: cleanLine(check.id || check.label || "media"),
        severity: "required",
        message: `${cleanLine(check.label || "미디어")} 조건이 충족되지 않았습니다. 현재 ${formatValue(
          check.actual,
        )}, 기준 ${formatValue(check.required)}입니다.`,
      });
    }
  }
  const requestResults = Array.isArray(verification.requestResults)
    ? verification.requestResults
    : [];
  for (const r of requestResults) {
    const status = String(r.status || "").trim();
    if (!["missing", "maybe_missing", "needs_review"].includes(status)) continue;
    const label = cleanLine(r.request || "기타 요청사항");
    issues.push({
      id: "additional_request",
      severity: status === "missing" ? "required" : "review",
      message: `기타 요청사항 반영 여부 확인이 필요합니다. (${label})`,
    });
  }
  return issues;
}

type RevisionInput = {
  campaign?: Partial<NormalizedCampaign>;
  verification?: Partial<VerificationResult>;
  normalizedPost?: NormalizedPost;
  revisionStyle?: string;
  title?: string;
  sourceUrl?: string;
};

export function buildRevisionRequest(input: RevisionInput = {}): RevisionResult {
  const campaign = input.campaign && typeof input.campaign === "object" ? input.campaign : {};
  const verification =
    input.verification && typeof input.verification === "object" ? input.verification : {};
  const post =
    input.normalizedPost && typeof input.normalizedPost === "object" ? input.normalizedPost : {};
  const style = revisionStyle(input.revisionStyle);
  const guide = REVISION_STYLE_GUIDES.get(style) || REVISION_STYLE_GUIDES.get("기본형")!;
  const issues = collectRevisionIssues(verification);
  const subject = cleanLine(campaign.subjectValue || "캠페인");
  const title = cleanLine(post.title || input.title || "");
  const url = cleanLine(post.sourceUrl || input.sourceUrl || "");
  const noIssue = !issues.length;
  const lines = [guide.intro, "", `캠페인 주제: ${subject}`];
  if (title) lines.push(`검수 게시글: ${title}`);
  if (url) lines.push(`검수 URL: ${url}`);
  lines.push("");
  if (noIssue) {
    lines.push(guide.noIssue);
    lines.push(
      "발행 전 오탈자, 최신 정보, 체험 사실, 사진/영상 노출 상태만 한 번 더 확인 부탁드립니다.",
    );
  } else {
    lines.push(guide.requestLine);
    lines.push("");
    issues.forEach((issue, i) => {
      lines.push(`${i + 1}. ${issue.message}`);
    });
    lines.push("");
    lines.push(guide.closing);
  }
  lines.push("");
  lines.push("감사합니다.");
  return {
    source: "local_template",
    aiPolished: false,
    fallbackReason: "",
    revisionStyle: style,
    passed: noIssue,
    issues,
    text: lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}

export function buildRevisionPolishPrompt(
  input: RevisionInput & { localRevision?: RevisionResult } = {},
): string {
  const campaign = input.campaign && typeof input.campaign === "object" ? input.campaign : {};
  const post =
    input.normalizedPost && typeof input.normalizedPost === "object" ? input.normalizedPost : {};
  const style = revisionStyle(input.revisionStyle || input.localRevision?.revisionStyle);
  const guide = REVISION_STYLE_GUIDES.get(style) || REVISION_STYLE_GUIDES.get("기본형")!;
  const local =
    input.localRevision && typeof input.localRevision === "object"
      ? input.localRevision
      : buildRevisionRequest({ ...input, revisionStyle: style });
  const subject = cleanLine(campaign.subjectValue || "캠페인");
  const title = cleanLine(post.title || "");
  const url = cleanLine(post.sourceUrl || "");
  const issueLines =
    Array.isArray(local.issues) && local.issues.length
      ? local.issues.map((issue, i) => `${i + 1}. ${issue.message}`)
      : ["- 수정 요청 항목 없음"];
  return [
    "역할: 블로그 체험단/협찬 게시글 검수 담당자",
    "목표: 아래 확정 검수 결과를 바탕으로 블로거에게 보낼 수정 요청 메시지를 정중하게 다듬는다.",
    `문구 스타일: ${style}`,
    `스타일 지시: ${guide.prompt}`,
    "",
    "절대 규칙:",
    "1. 확정 수정 항목을 삭제하거나 추가하지 않는다.",
    "2. 확정 수정 항목의 숫자, 키워드, 기준값, 현재값을 바꾸지 않는다.",
    "3. 아래 [확정 수정 항목]의 각 줄은 문장 그대로 포함한다.",
    "4. 사과 과다, 위협적 표현, 법적 표현, 과장 표현을 쓰지 않는다.",
    "5. 마크다운 제목, 코드블록, 표, JSON, 따옴표 포장을 쓰지 않는다.",
    "6. 최종 메시지만 출력한다.",
    "",
    "[캠페인]",
    `주제: ${subject}`,
    title ? `게시글 제목: ${title}` : "게시글 제목: 없음",
    url ? `게시글 URL: ${url}` : "게시글 URL: 없음",
    "",
    "[확정 수정 항목]",
    ...issueLines,
    "",
    "[로컬 초안]",
    local.text,
    "",
    "위 내용을 지정된 문구 스타일에 맞는 한국어 업무 메시지로 다듬어라.",
  ].join("\n");
}

export function normalizeAiRevisionText(value: unknown): string {
  let text = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  const fence = text.match(/^```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)\s*```$/);
  if (fence) text = fence[1].trim();
  return text
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => !/^(최종 메시지|수정 요청 메시지|답변|출력)\s*[:：]?\s*$/i.test(l.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function validatePolishedRevisionText(
  text: string,
  local: RevisionResult,
): { ok: boolean; reason: string; missing?: string[] } {
  if (!text) return { ok: false, reason: "empty_ai_revision" };
  if (text.length < 40) return { ok: false, reason: "too_short_ai_revision" };
  if (/```|\{[\s\S]*"text"[\s\S]*\}/.test(text))
    return { ok: false, reason: "wrapped_or_json_ai_revision" };
  const missing = (Array.isArray(local?.issues) ? local.issues : [])
    .map((i) => String(i.message || "").trim())
    .filter(Boolean)
    .filter((m) => !text.includes(m));
  return missing.length
    ? { ok: false, reason: "missing_confirmed_issue", missing }
    : { ok: true, reason: "" };
}

export function applyAiPolishedRevision(local: RevisionResult, aiText: unknown): RevisionResult {
  const base = local && typeof local === "object" ? local : buildRevisionRequest({});
  const normalized = normalizeAiRevisionText(aiText);
  const validation = validatePolishedRevisionText(normalized, base);
  return validation.ok
    ? { ...base, source: "ai_polished", aiPolished: true, fallbackReason: "", text: normalized }
    : { ...base, source: "local_template", aiPolished: false, fallbackReason: validation.reason };
}
