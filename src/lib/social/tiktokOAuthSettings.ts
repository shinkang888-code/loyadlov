import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const TIKTOK_OAUTH_SETTINGS_KEY = "tiktok_oauth_settings";

export type TikTokOAuthSettings = {
  clientKey?: string;
  clientSecret?: string;
  enabled?: boolean;
};

export type TikTokOAuthCredentials = {
  clientKey: string;
  clientSecret: string;
  source: "env" | "db" | "none";
};

async function getDbSettings(): Promise<TikTokOAuthSettings | null> {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", TIKTOK_OAUTH_SETTINGS_KEY)
      .maybeSingle();
    return (data?.value as TikTokOAuthSettings | null) ?? null;
  } catch {
    return null;
  }
}

export async function getTikTokOAuthCredentials(): Promise<TikTokOAuthCredentials> {
  const fromDb = await getDbSettings();
  const envKey = process.env.TIKTOK_CLIENT_KEY?.trim() ?? "";
  const envSecret = process.env.TIKTOK_CLIENT_SECRET?.trim() ?? "";
  const dbKey = fromDb?.clientKey?.trim() ?? "";
  const dbSecret = fromDb?.clientSecret?.trim() ?? "";

  if (fromDb?.enabled === false) {
    return { clientKey: "", clientSecret: "", source: "none" };
  }

  const clientKey = envKey || dbKey;
  const clientSecret = envSecret || dbSecret;

  if (clientKey && clientSecret) {
    return { clientKey, clientSecret, source: envKey && envSecret ? "env" : "db" };
  }
  return { clientKey: "", clientSecret: "", source: "none" };
}

export async function isTikTokOAuthEnabled(): Promise<boolean> {
  const creds = await getTikTokOAuthCredentials();
  return Boolean(creds.clientKey && creds.clientSecret);
}

export async function saveTikTokOAuthSettings(settings: TikTokOAuthSettings): Promise<boolean> {
  const { error } = await supabaseAdmin.from("app_settings").upsert({
    key: TIKTOK_OAUTH_SETTINGS_KEY,
    value: settings,
    updated_at: new Date().toISOString(),
  });
  return !error;
}
