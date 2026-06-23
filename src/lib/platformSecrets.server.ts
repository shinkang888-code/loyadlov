/**
 * 플랫폼 전역 시크릿 — Vercel env 우선, 없으면 app_settings.platform_secrets (DB)
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { setEncryptionKeyOverride } from "@/lib/social/tokenCrypto";

export const PLATFORM_SECRETS_KEY = "platform_secrets";

export type PlatformSecrets = {
  lovableApiKey?: string;
  appUrl?: string;
  cronSecret?: string;
  socialTokenEncryptionKey?: string;
  googleClientEmail?: string;
  googlePrivateKey?: string;
  googleDriveRootFolderId?: string;
  stripeSecretKey?: string;
  stripePublishableKey?: string;
  stripeWebhookSecret?: string;
  stripePriceStandard?: string;
  stripePricePremium?: string;
  runwayApiKey?: string;
  // === AI · 미디어 생성 연동 (관리자 콘솔 API 패널) ===
  geminiApiKey?: string;
  openaiApiKey?: string;
  higgsfieldApiKey?: string;
  higgsfieldSecret?: string;
  falKey?: string;
  figmaToken?: string;
  canvaApiKey?: string;
};

export type PlatformSecretField = keyof PlatformSecrets;

export type PlatformSetupStatus = {
  lovableApiKey: boolean;
  appUrl: boolean;
  cronSecret: boolean;
  socialTokenEncryptionKey: boolean;
  googleDrive: boolean;
  stripe: boolean;
  metaOAuth: boolean;
  youtubeOAuth: boolean;
  naverOAuth: boolean;
  tiktokOAuth: boolean;
  kakaoOAuth: boolean;
  kakaoChannel: boolean;
};

let dbCache: PlatformSecrets | null = null;
let dbCacheAt = 0;
const CACHE_MS = 30_000;

function pickEnv(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

export async function loadPlatformSecretsFromDb(): Promise<PlatformSecrets> {
  const now = Date.now();
  if (dbCache && now - dbCacheAt < CACHE_MS) return dbCache;
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", PLATFORM_SECRETS_KEY)
      .maybeSingle();
    dbCache = (data?.value as PlatformSecrets | null) ?? {};
    dbCacheAt = now;
    return dbCache;
  } catch {
    return {};
  }
}

export function invalidatePlatformSecretsCache(): void {
  dbCache = null;
  dbCacheAt = 0;
}

async function fromDb(field: PlatformSecretField): Promise<string | undefined> {
  const db = await loadPlatformSecretsFromDb();
  return db[field]?.trim() || undefined;
}

export async function resolvePlatformSecret(field: PlatformSecretField): Promise<string | undefined> {
  const envMap: Partial<Record<PlatformSecretField, string>> = {
    lovableApiKey: "LOVABLE_API_KEY",
    appUrl: "APP_URL",
    cronSecret: "CRON_SECRET",
    socialTokenEncryptionKey: "SOCIAL_TOKEN_ENCRYPTION_KEY",
    googleClientEmail: "GOOGLE_CLIENT_EMAIL",
    googlePrivateKey: "GOOGLE_PRIVATE_KEY",
    googleDriveRootFolderId: "GOOGLE_DRIVE_ROOT_FOLDER_ID",
    stripeSecretKey: "STRIPE_SECRET_KEY",
    stripePublishableKey: "STRIPE_PUBLISHABLE_KEY",
    stripeWebhookSecret: "STRIPE_WEBHOOK_SECRET",
    stripePriceStandard: "STRIPE_PRICE_STANDARD",
    stripePricePremium: "STRIPE_PRICE_PREMIUM",
    runwayApiKey: "RUNWAY_API_KEY",
    geminiApiKey: "GEMINI_API_KEY",
    openaiApiKey: "OPENAI_API_KEY",
    higgsfieldApiKey: "HIGGSFIELD_API_KEY",
    higgsfieldSecret: "HIGGSFIELD_SECRET",
    falKey: "FAL_KEY",
    figmaToken: "FIGMA_TOKEN",
    canvaApiKey: "CANVA_API_KEY",
  };
  const envKey = envMap[field];
  if (envKey) {
    const fromEnv = pickEnv(envKey);
    if (fromEnv) return fromEnv;
  }
  return fromDb(field);
}

export async function resolveLovableApiKey(): Promise<string | undefined> {
  return resolvePlatformSecret("lovableApiKey");
}

export async function resolveAppUrl(fallback?: string): Promise<string> {
  return (
    (await resolvePlatformSecret("appUrl")) ||
    pickEnv("APP_URL") ||
    fallback?.replace(/\/$/, "") ||
    "https://loyadbeta.vercel.app"
  );
}

export async function resolveCronSecret(): Promise<string | undefined> {
  return resolvePlatformSecret("cronSecret");
}

export async function resolveGoogleDriveCredentials(): Promise<{
  clientEmail?: string;
  privateKey?: string;
  rootFolderId?: string;
}> {
  const [clientEmail, privateKey, rootFolderId] = await Promise.all([
    resolvePlatformSecret("googleClientEmail"),
    resolvePlatformSecret("googlePrivateKey"),
    resolvePlatformSecret("googleDriveRootFolderId"),
  ]);
  return { clientEmail, privateKey, rootFolderId };
}

export async function resolveStripeCredentials(): Promise<{
  secretKey?: string;
  publishableKey?: string;
  webhookSecret?: string;
  priceStandard?: string;
  pricePremium?: string;
}> {
  const [secretKey, publishableKey, webhookSecret, priceStandard, pricePremium] = await Promise.all([
    resolvePlatformSecret("stripeSecretKey"),
    resolvePlatformSecret("stripePublishableKey"),
    resolvePlatformSecret("stripeWebhookSecret"),
    resolvePlatformSecret("stripePriceStandard"),
    resolvePlatformSecret("stripePricePremium"),
  ]);
  return { secretKey, publishableKey, webhookSecret, priceStandard, pricePremium };
}

/** 토큰 암호화 키를 메모리에 반영 (social OAuth 전 호출) */
export async function syncEncryptionKeyCache(): Promise<void> {
  const key =
    (await resolvePlatformSecret("socialTokenEncryptionKey")) ||
    pickEnv("SESSION_SECRET") ||
    pickEnv("SUPABASE_URL") ||
    "loyad-social-token-dev-key";
  setEncryptionKeyOverride(key);
}

export async function savePlatformSecrets(patch: Partial<PlatformSecrets>): Promise<boolean> {
  const existing = await loadPlatformSecretsFromDb();
  const merged: PlatformSecrets = { ...existing };
  for (const [k, v] of Object.entries(patch) as [PlatformSecretField, string | undefined][]) {
    if (v !== undefined && String(v).trim() !== "") {
      merged[k] = String(v).trim();
    }
  }
  const { error } = await supabaseAdmin.from("app_settings").upsert({
    key: PLATFORM_SECRETS_KEY,
    value: merged,
    updated_at: new Date().toISOString(),
  });
  if (!error) {
    dbCache = merged;
    dbCacheAt = Date.now();
    await syncEncryptionKeyCache();
  }
  return !error;
}

export function maskSecret(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (v.length <= 4) return "••••";
  return `••••••••${v.slice(-4)}`;
}

export async function getPlatformSetupStatus(): Promise<PlatformSetupStatus> {
  const [
    lovable,
    appUrl,
    cron,
    enc,
    driveEmail,
    stripeKey,
    meta,
    yt,
    naver,
    tiktok,
    kakao,
    kakaoCh,
  ] = await Promise.all([
    resolveLovableApiKey(),
    resolvePlatformSecret("appUrl"),
    resolveCronSecret(),
    resolvePlatformSecret("socialTokenEncryptionKey"),
    resolvePlatformSecret("googleClientEmail"),
    resolvePlatformSecret("stripeSecretKey"),
    import("@/lib/social/metaOAuthSettings").then((m) => m.getMetaOAuthCredentials()),
    import("@/lib/social/youtubeOAuthSettings").then((m) => m.getYouTubeOAuthCredentials()),
    import("@/lib/social/naverOAuthSettings").then((m) => m.getNaverOAuthCredentials()),
    import("@/lib/social/tiktokOAuthSettings").then((m) => m.getTikTokOAuthCredentials()),
    import("@/lib/social/kakaoOAuthSettings").then((m) => m.getKakaoOAuthCredentials()),
    import("@/lib/social/kakaoOAuthSettings").then((m) => m.resolveKakaoChannelPublicId()),
  ]);

  return {
    lovableApiKey: Boolean(lovable),
    appUrl: Boolean(appUrl),
    cronSecret: Boolean(cron),
    socialTokenEncryptionKey: Boolean(enc),
    googleDrive: Boolean(driveEmail),
    stripe: Boolean(stripeKey),
    metaOAuth: Boolean(meta.appId && meta.appSecret),
    youtubeOAuth: Boolean(yt.clientId && yt.clientSecret),
    naverOAuth: Boolean(naver.clientId && naver.clientSecret),
    tiktokOAuth: Boolean(tiktok.clientKey && tiktok.clientSecret),
    kakaoOAuth: Boolean(kakao.restApiKey && kakao.clientSecret),
    kakaoChannel: Boolean(kakaoCh),
  };
}

export function computeSetupPercent(status: PlatformSetupStatus): number {
  const checks = Object.values(status);
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

// =====================================================================
// AI · 미디어 생성 연동 (Gemini / OpenAI / Higgsfield / fal / Figma / Canva)
// =====================================================================

export type AiIntegrationProvider =
  | "gemini"
  | "openai"
  | "higgsfield"
  | "fal"
  | "figma"
  | "canva";

export type AiIntegrationStatus = Record<AiIntegrationProvider, boolean> & {
  lovable: boolean;
};

export async function resolveGeminiApiKey(): Promise<string | undefined> {
  return resolvePlatformSecret("geminiApiKey");
}

export async function resolveOpenAiApiKey(): Promise<string | undefined> {
  return resolvePlatformSecret("openaiApiKey");
}

export async function resolveHiggsfieldCredentials(): Promise<{
  apiKey?: string;
  secret?: string;
}> {
  const [apiKey, secret] = await Promise.all([
    resolvePlatformSecret("higgsfieldApiKey"),
    resolvePlatformSecret("higgsfieldSecret"),
  ]);
  return { apiKey, secret };
}

export async function resolveFalKey(): Promise<string | undefined> {
  return resolvePlatformSecret("falKey");
}

export async function resolveFigmaToken(): Promise<string | undefined> {
  return resolvePlatformSecret("figmaToken");
}

export async function resolveCanvaApiKey(): Promise<string | undefined> {
  return resolvePlatformSecret("canvaApiKey");
}

/** API 연동 패널용 상태 — 키가 입력되어 있는지(env/DB)만 판정 */
export async function getAiIntegrationStatus(): Promise<AiIntegrationStatus> {
  const [lovable, gemini, openai, hf, fal, figma, canva] = await Promise.all([
    resolveLovableApiKey(),
    resolveGeminiApiKey(),
    resolveOpenAiApiKey(),
    resolveHiggsfieldCredentials(),
    resolveFalKey(),
    resolveFigmaToken(),
    resolveCanvaApiKey(),
  ]);
  return {
    lovable: Boolean(lovable),
    gemini: Boolean(gemini),
    openai: Boolean(openai),
    higgsfield: Boolean(hf.apiKey && hf.secret),
    fal: Boolean(fal),
    figma: Boolean(figma),
    canva: Boolean(canva),
  };
}
