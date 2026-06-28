const DEFAULT_AUTH_URL =
  "https://ep-long-union-aj257yu8.neonauth.c-3.us-east-2.aws.neon.tech/neondb/auth";

export function getNeonAuthUrl(path = ""): string {
  const base = (
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_NEON_AUTH_URL) ||
    (typeof process !== "undefined" && process.env?.NEON_AUTH_URL) ||
    (typeof process !== "undefined" && process.env?.VITE_NEON_AUTH_URL) ||
    DEFAULT_AUTH_URL
  )
    .trim()
    .replace(/\/$/, "");
  const p = path.startsWith("/") ? path : path ? `/${path}` : "";
  return `${base}${p}`;
}

export const NEON_AUTH_JWKS_URL = `${getNeonAuthUrl()}/.well-known/jwks.json`;

const DEFAULT_APP_ORIGIN = "https://loyadlov.vercel.app";

/** OAuth·이메일 인증 리다이렉트용 앱 origin (항상 절대 URL) */
export function getAppOrigin(): string {
  const fromEnv =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_URL) ||
    (typeof process !== "undefined" && process.env?.APP_URL) ||
    (typeof process !== "undefined" && process.env?.VITE_APP_URL);

  const raw =
    (typeof fromEnv === "string" && fromEnv.trim()) ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    DEFAULT_APP_ORIGIN;

  return raw.replace(/\/$/, "");
}

export function getAuthCallbackUrl(path = "/admin"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getAppOrigin()}${normalized}`;
}

/** 브라우저 Auth 클라이언트 — same-origin 프록시 (3rd-party 쿠키 회피) */
export function getNeonAuthClientUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/auth`;
  }
  return `${getAppOrigin()}/api/auth`;
}
