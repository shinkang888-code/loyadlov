// filepath: src/lib/blog/naverMobileUrl.ts
/**
 * 네이버 블로그 글 URL 정규화 (검수 입력용).
 * 원본: daf-review-brief-studio/electron/lib/naver-mobile-url.cjs.
 */
export type NaverUrlResult =
  | { ok: true; originalUrl: string; blogId: string; logNo: string; mobileUrl: string }
  | { ok: false; originalUrl: string; reason: string };

function cleanPathToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

function isLikelyLogNo(value: unknown): boolean {
  return /^\d{5,}$/.test(String(value ?? "").trim());
}

export function isAllowedNaverHost(host: string): boolean {
  const h = String(host || "").toLowerCase();
  return h === "naver.com" || h.endsWith(".naver.com");
}

function validResult(original: string, blogId: string, logNo: string): NaverUrlResult {
  const id = cleanPathToken(blogId);
  const log = cleanPathToken(logNo);
  return {
    ok: true,
    originalUrl: original,
    blogId: id,
    logNo: log,
    mobileUrl: `https://m.blog.naver.com/${encodeURIComponent(id)}/${encodeURIComponent(log)}`,
  };
}

function invalidResult(original: string, reason: string): NaverUrlResult {
  return { ok: false, originalUrl: original, reason };
}

function parseDirectPath(url: URL): { blogId: string; logNo: string } | null {
  let parts: string[] = [];
  try {
    parts = url.pathname
      .split("/")
      .map((p) => decodeURIComponent(p).trim())
      .filter(Boolean);
  } catch {
    return null;
  }
  if (parts.length < 2) return null;
  return isLikelyLogNo(parts[1]) ? { blogId: parts[0], logNo: parts[1] } : null;
}

function parseQueryShape(url: URL): { blogId: string; logNo: string } | null {
  const blogId = url.searchParams.get("blogId") || url.searchParams.get("blogid");
  const logNo = url.searchParams.get("logNo") || url.searchParams.get("logno");
  return blogId && logNo && isLikelyLogNo(logNo)
    ? { blogId: cleanPathToken(blogId), logNo: cleanPathToken(logNo) }
    : null;
}

export function normalizeNaverBlogPostUrl(value: unknown): NaverUrlResult {
  const original = String(value ?? "")
    .trim()
    .slice(0, 2000);
  if (!original) return invalidResult(original, "URL을 입력해주세요.");
  let url: URL;
  try {
    url = new URL(original);
  } catch {
    return invalidResult(original, "올바른 URL이 아닙니다.");
  }
  const host = url.hostname.toLowerCase();
  if (!["http:", "https:"].includes(url.protocol))
    return invalidResult(original, "http 또는 https URL만 검수할 수 있습니다.");
  if (!isAllowedNaverHost(host))
    return invalidResult(original, "네이버 블로그 URL만 검수할 수 있습니다.");
  const direct = parseDirectPath(url);
  if (direct) return validResult(original, direct.blogId, direct.logNo);
  const query = parseQueryShape(url);
  return query
    ? validResult(original, query.blogId, query.logNo)
    : invalidResult(original, "blogId와 logNo를 찾지 못했습니다.");
}
