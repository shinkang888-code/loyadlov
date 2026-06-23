// filepath: src/lib/blog/textMetrics.ts
/**
 * 본문 글자수 / 키워드 등장수 계량.
 * 원본: daf-review-brief-studio/electron/lib/text-metrics.cjs.
 */
import type { KeywordReportItem, TextMetrics } from "./types";

export function normalizeBodyText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export function countBodyCharsNoSpaces(value: unknown): number {
  return Array.from(normalizeBodyText(value).replace(/\s+/g, "")).length;
}

function escapeRegExp(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function countKeywordOccurrences(body: unknown, keyword: unknown): number {
  const kw = String(keyword ?? "").trim();
  if (!kw) return 0;
  const text = normalizeBodyText(body);
  const flags = /[A-Za-z]/.test(kw) ? "giu" : "gu";
  const matches = text.match(new RegExp(escapeRegExp(kw), flags));
  return matches ? matches.length : 0;
}

export function buildKeywordReport(
  body: unknown,
  keywords: string[],
  requiredCount = 1,
): KeywordReportItem[] {
  const required = Math.max(0, Number.parseInt(String(requiredCount ?? 0), 10) || 0);
  return (Array.isArray(keywords) ? keywords : []).map((keyword) => {
    const count = countKeywordOccurrences(body, keyword);
    return {
      keyword,
      count,
      required,
      passed: count >= required,
      missing: Math.max(0, required - count),
    };
  });
}

export function buildTextMetrics(
  body: unknown,
  opts: { bodyMinCharsNoSpaces?: number; keywords?: string[]; keywordRequiredCount?: number } = {},
): TextMetrics {
  const bodyCharsNoSpaces = countBodyCharsNoSpaces(body);
  const bodyTarget = Math.max(0, Number.parseInt(String(opts.bodyMinCharsNoSpaces ?? 0), 10) || 0);
  return {
    bodyCharsNoSpaces,
    bodyTarget,
    bodyPassed: bodyCharsNoSpaces >= bodyTarget,
    keywordReport: buildKeywordReport(body, opts.keywords || [], opts.keywordRequiredCount),
  };
}
