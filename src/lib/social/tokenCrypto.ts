/**
 * 소셜 OAuth 토큰 AES-256-GCM 암호화
 */

import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw =
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim() ??
    process.env.SESSION_SECRET?.trim() ??
    process.env.SUPABASE_URL?.trim() ??
    "loyad-social-token-dev-key";
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptToken(payload: string): string | null {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) return null;
  try {
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}
