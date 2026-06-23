// filepath: src/lib/blog/campaignInput.ts
/**
 * 캠페인 입력 정규화.
 * 원본: daf-review-brief-studio/electron/lib/campaign-input.cjs (Electron 비의존 순수 로직).
 */
import type { MediaRequirements, NormalizedCampaign } from "./types";

export const DEFAULT_KEYWORD_REQUIRED_COUNT = 3;
export const DEFAULT_BODY_MIN_CHARS = 1000;
export const SUBJECT_MAX_CHARS = 120;
export const KEYWORD_MAX_CHARS = 60;
export const KEYWORD_MAX_COUNT = 30;
export const ADDITIONAL_REQUESTS_MAX_CHARS = 1000;
export const MAP_PLACE_MAX_CHARS = 120;

export function safeTextLimit(value: unknown, limit: number): string {
  return String(value ?? "").slice(0, Math.max(0, Number(limit) || 0));
}

export function cleanText(value: unknown, fallback = "", limit = 0): string {
  const text =
    String(value ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim() || fallback;
  return limit > 0 ? safeTextLimit(text, limit) : text;
}

export function cleanSingleLine(value: unknown, fallback = "", limit = 0): string {
  return cleanText(value, fallback, limit).replace(/\s+/g, " ").trim() || fallback;
}

export function toPositiveInteger(
  value: unknown,
  fallback: number,
  opts: { min?: number; max?: number } = {},
): number {
  const min = Number.isFinite(opts.min) ? Number(opts.min) : 1;
  const max = Number.isFinite(opts.max) ? Number(opts.max) : Number.MAX_SAFE_INTEGER;
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.min(parsed, max);
}

export function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes", "y", "on", "required", "필수", "예"].includes(v);
}

function uniqueStrings(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const key = item.toLocaleLowerCase("ko-KR");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

export function parseKeywordList(
  value: unknown,
  opts: { maxItems?: number; maxLength?: number } = {},
): string[] {
  const maxItems = Number.isFinite(opts.maxItems) ? Number(opts.maxItems) : KEYWORD_MAX_COUNT;
  const maxLength = Number.isFinite(opts.maxLength) ? Number(opts.maxLength) : KEYWORD_MAX_CHARS;
  if (Array.isArray(value)) {
    return uniqueStrings(value.map((e) => cleanSingleLine(e, "", maxLength)).filter(Boolean)).slice(
      0,
      maxItems,
    );
  }
  return uniqueStrings(
    String(value ?? "")
      .split(",")
      .map((e) => cleanSingleLine(e, "", maxLength))
      .filter(Boolean),
  ).slice(0, maxItems);
}

type MediaInput = Record<string, unknown> & { mediaRequirements?: Record<string, unknown> };

export function normalizeMediaRequirements(input: MediaInput = {}): MediaRequirements {
  const src =
    input.mediaRequirements && typeof input.mediaRequirements === "object"
      ? (input.mediaRequirements as Record<string, unknown>)
      : (input as Record<string, unknown>);
  return {
    imageMinCount: toPositiveInteger(
      src.imageMinCount ?? src.image_min_count ?? src.imageCount,
      0,
      { min: 0, max: 200 },
    ),
    videoRequired: toBoolean(src.videoRequired ?? src.video_required),
    videoMinSeconds: toPositiveInteger(src.videoMinSeconds ?? src.video_min_seconds, 15, {
      min: 1,
      max: 3600,
    }),
    mapRequired: toBoolean(src.mapRequired ?? src.map_required),
    mapPlaceName: cleanSingleLine(
      src.mapPlaceName ?? src.map_place_name ?? input.subjectValue ?? input.subject_value,
      "",
      MAP_PLACE_MAX_CHARS,
    ),
  };
}

export function normalizeCampaignInput(input: Record<string, unknown> = {}): NormalizedCampaign {
  const subjectValue = cleanSingleLine(
    input.subjectValue ?? input.subject_value,
    "",
    SUBJECT_MAX_CHARS,
  );
  return {
    subjectValue,
    keywords: parseKeywordList(input.keywords ?? input.keywordText ?? input.keyword_text),
    keywordRequiredCount: toPositiveInteger(
      input.keywordRequiredCount ?? input.keyword_required_count,
      DEFAULT_KEYWORD_REQUIRED_COUNT,
      { min: 1, max: 30 },
    ),
    bodyMinCharsNoSpaces: toPositiveInteger(
      input.bodyMinCharsNoSpaces ?? input.body_min_chars_no_spaces ?? input.bodyMinChars,
      DEFAULT_BODY_MIN_CHARS,
      { min: 0, max: 100000 },
    ),
    mediaRequirements: normalizeMediaRequirements({ ...input, subjectValue }),
    additionalRequests: cleanText(
      input.additionalRequests ?? input.additional_requests,
      "",
      ADDITIONAL_REQUESTS_MAX_CHARS,
    ),
  };
}
