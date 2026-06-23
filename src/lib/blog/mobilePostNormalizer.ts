// filepath: src/lib/blog/mobilePostNormalizer.ts
/**
 * 발행된 모바일 글 스냅샷 정규화 (검수 입력 표준화).
 * 원본: daf-review-brief-studio/electron/lib/mobile-post-normalizer.cjs.
 */
import type { NormalizedPost } from "./types";

export const TITLE_MAX_CHARS = 200;
export const BODY_TEXT_MAX_CHARS = 20000;

function cleanSingleLine(value: unknown, limit = 0): string {
  const v = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return limit > 0 ? v.slice(0, limit) : v;
}

function normalizeBodyText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, BODY_TEXT_MAX_CHARS);
}

function toNonNegativeInteger(value: unknown): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  return !Number.isFinite(n) || n < 0 ? 0 : n;
}

function mergeDiagnostics(base: string[], extra: unknown): string[] {
  const out = [...base];
  for (const item of Array.isArray(extra) ? extra : []) {
    const v = cleanSingleLine(item);
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

type Snapshot = {
  title?: unknown;
  bodyText?: unknown;
  extractedBody?: unknown;
  url?: unknown;
  sourceUrl?: unknown;
  selector?: unknown;
  imageCount?: unknown;
  videoFound?: unknown;
  mapFound?: unknown;
  media?: { imageCount?: unknown; videoFound?: unknown; mapFound?: unknown };
  diagnostics?: unknown;
};

export function normalizeMobilePostSnapshot(
  snapshot: Snapshot = {},
): NormalizedPost & { selector: string; confidence: string; diagnostics: string[] } {
  const missing: string[] = [];
  const title = cleanSingleLine(snapshot.title, TITLE_MAX_CHARS);
  const bodyText = normalizeBodyText(snapshot.bodyText ?? snapshot.extractedBody);
  const media = snapshot.media && typeof snapshot.media === "object" ? snapshot.media : {};
  const imageCount = toNonNegativeInteger(media.imageCount ?? snapshot.imageCount);
  const videoFound = Boolean(media.videoFound ?? snapshot.videoFound);
  const mapFound = Boolean(media.mapFound ?? snapshot.mapFound);
  if (!title) missing.push("title_missing");
  if (!bodyText) missing.push("body_missing");
  return {
    title,
    bodyText,
    media: { imageCount, videoFound, mapFound },
    sourceUrl: cleanSingleLine(snapshot.sourceUrl ?? snapshot.url, 2000),
    selector: cleanSingleLine(snapshot.selector, 400),
    confidence: missing.length ? "needs_review" : "high",
    diagnostics: mergeDiagnostics(missing, snapshot.diagnostics),
  };
}
