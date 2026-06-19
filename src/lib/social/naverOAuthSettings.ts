import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const NAVER_OAUTH_SETTINGS_KEY = "naver_oauth_settings";

export type NaverOAuthSettings = {
  clientId?: string;
  clientSecret?: string;
  enabled?: boolean;
};

export type NaverOAuthCredentials = {
  clientId: string;
  clientSecret: string;
  source: "env" | "db" | "none";
};

async function getDbSettings(): Promise<NaverOAuthSettings | null> {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", NAVER_OAUTH_SETTINGS_KEY)
      .maybeSingle();
    return (data?.value as NaverOAuthSettings | null) ?? null;
  } catch {
    return null;
  }
}

export async function getNaverOAuthCredentials(): Promise<NaverOAuthCredentials> {
  const fromDb = await getDbSettings();
  const envId = process.env.NAVER_OAUTH_CLIENT_ID?.trim() ?? "";
  const envSecret = process.env.NAVER_OAUTH_CLIENT_SECRET?.trim() ?? "";
  const dbId = fromDb?.clientId?.trim() ?? "";
  const dbSecret = fromDb?.clientSecret?.trim() ?? "";

  if (fromDb?.enabled === false) {
    return { clientId: "", clientSecret: "", source: "none" };
  }

  const clientId = envId || dbId;
  const clientSecret = envSecret || dbSecret;

  if (clientId && clientSecret) {
    return {
      clientId,
      clientSecret,
      source: envId && envSecret ? "env" : "db",
    };
  }

  return { clientId: "", clientSecret: "", source: "none" };
}

export async function isNaverOAuthEnabled(): Promise<boolean> {
  const creds = await getNaverOAuthCredentials();
  return Boolean(creds.clientId && creds.clientSecret);
}

export async function saveNaverOAuthSettings(settings: NaverOAuthSettings): Promise<boolean> {
  const { error } = await supabaseAdmin.from("app_settings").upsert({
    key: NAVER_OAUTH_SETTINGS_KEY,
    value: settings,
    updated_at: new Date().toISOString(),
  });
  return !error;
}
