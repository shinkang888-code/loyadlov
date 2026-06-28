import { getAppOrigin, getNeonAuthUrl } from "@/integrations/neon/auth-config";

const NEON_AUTH_COOKIE_PREFIX = "__Secure-neon-auth";
const PROXY_HEADERS = ["user-agent", "authorization", "referer", "content-type"] as const;

function parseCookieHeader(header: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    map.set(part.slice(0, idx).trim(), part.slice(idx + 1).trim());
  }
  return map;
}

function extractNeonAuthCookies(headers: Headers): string {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return "";
  const parsed = parseCookieHeader(cookieHeader);
  const parts: string[] = [];
  for (const [name, value] of parsed.entries()) {
    if (name.startsWith(NEON_AUTH_COOKIE_PREFIX)) parts.push(`${name}=${value}`);
  }
  return parts.join("; ");
}

/** Neon Auth Set-Cookie → 1st-party (SameSite=Lax, Partitioned 제거) */
function rewriteSetCookie(raw: string): string {
  const kept: string[] = [];
  let pair = "";

  for (const part of raw.split(";")) {
    const p = part.trim();
    if (!p) continue;
    if (/^Domain=/i.test(p)) continue;
    if (/^SameSite=/i.test(p)) continue;
    if (/^Partitioned$/i.test(p)) continue;
    if (!pair) {
      pair = p;
      continue;
    }
    if (/^Path=/i.test(p)) continue;
    kept.push(p);
  }

  const parts = [
    pair,
    ...kept.filter((p) => !/^Secure$/i.test(p)),
    "Path=/",
    "Secure",
    "SameSite=Lax",
  ];
  return parts.join("; ");
}

/** Neon Auth 요청을 같은 origin `/api/auth/*` 로 프록시 (1st-party 쿠키) */
export async function handleNeonAuthProxy(request: Request, path: string): Promise<Response> {
  const upstream = new URL(`${getNeonAuthUrl()}/${path.replace(/^\/+/, "")}`);
  upstream.search = new URL(request.url).search;

  const headers = new Headers();
  for (const name of PROXY_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Origin", getAppOrigin());
  headers.set("x-neon-auth-middleware", "true");

  const neonCookies = extractNeonAuthCookies(request.headers);
  if (neonCookies) headers.set("Cookie", neonCookies);

  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();

  const upstreamRes = await fetch(upstream, {
    method: request.method,
    headers,
    body,
  });

  const outHeaders = new Headers();
  const contentType = upstreamRes.headers.get("content-type");
  if (contentType) outHeaders.set("content-type", contentType);

  for (const jwt of ["set-auth-jwt", "set-auth-token"] as const) {
    const value = upstreamRes.headers.get(jwt);
    if (value) outHeaders.set(jwt, value);
  }

  for (const raw of upstreamRes.headers.getSetCookie()) {
    outHeaders.append("Set-Cookie", rewriteSetCookie(raw));
  }

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: outHeaders,
  });
}
