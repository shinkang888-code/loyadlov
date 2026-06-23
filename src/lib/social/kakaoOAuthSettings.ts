import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const KAKAO_OAUTH_SETTINGS_KEY = "kakao_oauth_settings";

export type KakaoOAuthSettings = {
  restApiKey?: string;
  clientSecret?: string;
  /** 카카오톡 채널 Public ID (예: _ZeUTxl) */
  channelPublicId?: string;
  enabled?: boolean;
};

export type KakaoOAuthCredentials = {
  restApiKey: string;
  clientSecret: string;
  source: "env" | "db" | "none";
};

async function getDbSettings(): Promise<KakaoOAuthSettings | null> {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", KAKAO_OAUTH_SETTINGS_KEY)
      .maybeSingle();
    return (data?.value as KakaoOAuthSettings | null) ?? null;
  } catch {
    return null;
  }
}

export async function getKakaoOAuthCredentials(): Promise<KakaoOAuthCredentials> {
  const fromDb = await getDbSettings();
  const envKey = process.env.KAKAO_REST_API_KEY?.trim() ?? "";
  const envSecret = process.env.KAKAO_CLIENT_SECRET?.trim() ?? "";
  const dbKey = fromDb?.restApiKey?.trim() ?? "";
  const dbSecret = fromDb?.clientSecret?.trim() ?? "";

  if (fromDb?.enabled === false) {
    return { restApiKey: "", clientSecret: "", source: "none" };
  }

  const restApiKey = envKey || dbKey;
  const clientSecret = envSecret || dbSecret;

  if (restApiKey && clientSecret) {
    return { restApiKey, clientSecret, source: envKey && envSecret ? "env" : "db" };
  }
  return { restApiKey: "", clientSecret: "", source: "none" };
}

export async function isKakaoOAuthEnabled(): Promise<boolean> {
  const creds = await getKakaoOAuthCredentials();
  return Boolean(creds.restApiKey && creds.clientSecret);
}

export async function saveKakaoOAuthSettings(settings: KakaoOAuthSettings): Promise<boolean> {
  const { error } = await supabaseAdmin.from("app_settings").upsert({
    key: KAKAO_OAUTH_SETTINGS_KEY,
    value: settings,
    updated_at: new Date().toISOString(),
  });
  return !error;
}

/** OAuth 발행·콜백에서 사용할 채널 Public ID (env > DB) */
export async function resolveKakaoChannelPublicId(): Promise<string | null> {
  const envId = process.env.KAKAO_CHANNEL_PUBLIC_ID?.trim() ?? "";
  if (envId) return envId;
  const fromDb = await getDbSettings();
  return fromDb?.channelPublicId?.trim() || null;
}
