// filepath: src/lib/blog/draftVerification.ts
/**
 * AI 블로그 초안 — 디터미니스틱 캠페인 브리프 검수 + 역산 리페어 프롬프트 + 로컬 폴백 보정.
 */
import { buildTextMetrics, countBodyCharsNoSpaces, normalizeBodyText } from "./textMetrics";
import {
  looksLikeAiDraftFailure,
  looksLikePromptEcho,
  writerStyle,
} from "./draftAi";
import { cleanSingleLine } from "./campaignInput";
import type { DraftOptions, NormalizedCampaign, ParsedDraft, VerificationResult } from "./types";
import { verifyPostAgainstCampaign } from "./verificationEngine";

function clip(value: unknown, limit: number): string {
  return cleanSingleLine(value, "").slice(0, limit);
}

function currentKstDate(): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function hasHtmlMediaMarkup(body: string): boolean {
  return /<(img|video|iframe|map)\b/i.test(body);
}

function mediaChecksEnabled(campaign: NormalizedCampaign): boolean {
  const m = campaign.mediaRequirements;
  return (
    (m.imageMinCount ?? 0) > 0 || Boolean(m.videoRequired) || Boolean(m.mapRequired)
  );
}

/** 제목·파싱·거절문구 등 구조 검사 (본문 글자수는 verificationEngine에 위임). */
export function validateDraftStructure(draft: ParsedDraft): { ok: boolean; reason: string } {
  if (!draft?.parsed) return { ok: false, reason: draft?.reason || "not_parsed" };
  const title = cleanSingleLine(draft.title);
  const body = normalizeBodyText(draft.body).trim();
  if (title.length < 4) return { ok: false, reason: "title_too_short" };
  if (title.length > 90) return { ok: false, reason: "title_too_long" };
  if (body.length < 80) return { ok: false, reason: "body_too_short" };
  if (looksLikeAiDraftFailure(body) || looksLikePromptEcho(body)) {
    return { ok: false, reason: "failure_or_prompt_echo" };
  }
  return { ok: true, reason: "ok" };
}

export type DraftEvaluation = {
  passed: boolean;
  structureOk: boolean;
  verification: VerificationResult;
  structureReason?: string;
};

export type EvaluateDraftOptions = {
  /** @deprecated 본문 글자수는 campaign.bodyMinCharsNoSpaces(공백 제외)로 검수 */
  minBodyLength?: number;
  /** plain text 초안 생성 단계에서는 HTML 미디어 노드 검수 생략 */
  skipMediaForPlainText?: boolean;
};

export function evaluateDraftAgainstCampaign(
  campaign: NormalizedCampaign,
  draft: ParsedDraft,
  opts: EvaluateDraftOptions = {},
): DraftEvaluation {
  const structure = validateDraftStructure(draft);
  let verification = verifyPostAgainstCampaign(campaign, { bodyText: draft.body }, []);

  const skipMedia =
    opts.skipMediaForPlainText !== false &&
    !hasHtmlMediaMarkup(draft.body) &&
    mediaChecksEnabled(campaign);

  if (skipMedia) {
    const keywordsPassed = verification.keywords.every((k) => k.passed);
    const passed = structure.ok && verification.body.passed && keywordsPassed;
    verification = {
      ...verification,
      passed,
      status: passed ? "passed" : verification.status,
      media: {
        ...verification.media,
        passed: true,
        checks: verification.media.checks.map((c) => ({ ...c, passed: true })),
      },
    };
  }

  const passed = structure.ok && verification.passed;
  return {
    passed,
    structureOk: structure.ok,
    verification,
    structureReason: structure.reason,
  };
}

export function buildQuantifiedRepairPrompt(
  campaign: NormalizedCampaign,
  evaluation: DraftEvaluation,
  opts: DraftOptions = {},
): string {
  const style = writerStyle(opts.writer);
  const subject = clip(campaign.subjectValue || "앞선 요청의 주제", 160);
  const v = evaluation.verification;
  const lines = [
    "이전 원고는 캠페인 브리프 정량 조건을 충족하지 못했습니다. 아래 수치를 반드시 맞춰 다시 작성하세요.",
    `기준일: ${currentKstDate()}`,
    `주제: ${subject}`,
    `작가 스타일: ${style}`,
    "",
    "[정량 보완 지시 — LLM 추정 금지, 아래 수치를 목표로 작성]",
  ];

  if (!v.body.passed) {
    const deficit = Math.max(0, v.body.required - v.body.charsNoSpaces);
    lines.push(
      `- 공백 제외 본문 글자수: 현재 ${v.body.charsNoSpaces}자 → 최소 ${v.body.required}자 필요 (약 ${deficit}자 추가)`,
    );
  }

  const failedKw = v.keywords.filter((k) => !k.passed);
  if (failedKw.length) {
    lines.push("- 키워드 최소 등장 횟수:");
    for (const k of failedKw) {
      lines.push(`  · "${k.keyword}": 현재 ${k.count}회 → 최소 ${k.required}회 (${k.missing}회 부족)`);
    }
  }

  if (campaign.keywords.length) {
    lines.push(`- 반드시 포함할 키워드: ${campaign.keywords.join(", ")}`);
  }

  if (!evaluation.structureOk && evaluation.structureReason) {
    lines.push(`- 구조 오류: ${evaluation.structureReason} — 제목+도입+소제목 4개+마치며 형식 준수`);
  }

  lines.push(
    "",
    "출력 규칙:",
    "- 한국어 네이버 블로그 원고만 출력",
    "- 첫 줄은 제목, 도입부 1문단, 일반 텍스트 소제목 4개, 마지막 소제목 `마치며`",
    `- 공백 제외 본문 최소 ${campaign.bodyMinCharsNoSpaces}자 이상`,
    "- URL, 표, 코드블록, JSON, 이미지, 링크, 후속 질문 금지",
    "- 키워드는 문맥 안에 자연스럽게 배치 (억지 나열 금지)",
    "",
    "지금 바로 수정된 원고 본문만 출력하세요.",
  );
  return lines.join("\n");
}

/** 검수 실패 시 CPU 연산만으로 본문·키워드 조건을 맞춘다 (4단계 루프 최종 폴백). */
export function enforceDraftMetrics(
  draft: ParsedDraft,
  campaign: NormalizedCampaign,
): ParsedDraft {
  let body = String(draft.body ?? "").trim();
  const target = Math.max(0, campaign.bodyMinCharsNoSpaces || 0);
  const kwRequired = Math.max(1, campaign.keywordRequiredCount || 1);
  const keywords = campaign.keywords.filter(Boolean);

  const padBlock = (): string => {
    const kwLine =
      keywords.length > 0
        ? keywords
            .map((k) => `${k}에 대해 ${campaign.subjectValue} 맥락에서 확인할 점을 정리합니다.`)
            .join(" ")
        : `${campaign.subjectValue} 관련 실제 방문·이용 시 참고할 정보를 차분히 정리합니다.`;
    return [
      kwLine,
      "독자가 검색 의도에 맞게 정보를 비교할 수 있도록 장점과 확인 포인트를 균형 있게 서술합니다.",
      "과장된 표현 없이 체감할 수 있는 디테일을 덧붙여 신뢰감 있는 흐름을 유지합니다.",
    ].join("\n\n");
  };

  let guard = 0;
  while (countBodyCharsNoSpaces(body) < target && guard < 40) {
    body = `${body}\n\n${padBlock()}`;
    guard += 1;
  }

  for (const keyword of keywords) {
    const metrics = buildTextMetrics(body, campaign);
    const row = metrics.keywordReport.find((k) => k.keyword === keyword);
    const missing = row ? row.missing : kwRequired;
    if (missing <= 0) continue;
    const inserts = Array.from(
      { length: missing },
      () => `${keyword}는 ${campaign.subjectValue} 글에서 독자가 자주 찾는 핵심 표현입니다.`,
    );
    body = `${body}\n\n${inserts.join(" ")}`;
  }

  return {
    ...draft,
    source: draft.source.includes("fallback") ? draft.source : `${draft.source}+metrics_enforced`,
    body,
  };
}

export function buildVerificationSummary(evaluation: DraftEvaluation): Record<string, unknown> {
  const v = evaluation.verification;
  return {
    passed: evaluation.passed,
    structureOk: evaluation.structureOk,
    body: v.body,
    keywords: v.keywords,
    media: v.media,
    status: v.status,
  };
}

export function buildVerificationFailureMessage(summary: Record<string, unknown>): string {
  const body = summary.body as { charsNoSpaces?: number; required?: number; passed?: boolean } | undefined;
  const keywords = (summary.keywords as { keyword?: string; missing?: number; passed?: boolean }[]) ?? [];
  const parts: string[] = ["캠페인 브리프 정량 검수 미통과"];
  if (body && body.passed === false) {
    parts.push(`본문 ${body.charsNoSpaces ?? 0}/${body.required ?? 0}자(공백 제외)`);
  }
  for (const k of keywords.filter((row) => row.passed === false)) {
    parts.push(`키워드 "${k.keyword}" ${k.missing ?? 0}회 부족`);
  }
  return parts.join(" · ").slice(0, 500);
}
