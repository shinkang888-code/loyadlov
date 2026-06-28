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
