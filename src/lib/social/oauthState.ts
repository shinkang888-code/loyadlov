import crypto from "crypto";
import type { SocialPlatform } from "@/lib/social/types";

export type SocialOAuthPlatform = SocialPlatform | "meta";

const SECRET =
  process.env.OAUTH_STATE_SECRET ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "loyad-social-oauth";

export type SocialOAuthMode = "connect";

export interface SocialOAuthStatePayload {
  mode: SocialOAuthMode;
  platform: SocialOAuthPlatform;
  loginId: string;
  storeCode: string;
  nonce: string;
  ts: number;
}

export function signSocialOAuthState(payload: Omit<SocialOAuthStatePayload, "nonce" | "ts">): string {
  const full: SocialOAuthStatePayload = {
    ...payload,
    nonce: crypto.randomBytes(8).toString("hex"),
    ts: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(full), "utf-8").toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySocialOAuthState(state: string): SocialOAuthStatePayload | null {
  const [encoded, sig] = state.split(".");
  if (!encoded || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(encoded).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as SocialOAuthStatePayload;
    if (parsed.mode !== "connect" || !parsed.loginId?.trim() || !parsed.storeCode?.trim()) return null;
    if (!parsed.ts || Date.now() - parsed.ts > 15 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}
