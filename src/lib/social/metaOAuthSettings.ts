import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const META_OAUTH_SETTINGS_KEY = "meta_oauth_settings";

export type MetaOAuthSettings = {
  appId?: string;
  appSecret?: string;
  enabled?: boolean;
};

export type MetaOAuthCredentials = {
  appId: string;
  appSecret: string;
  source: "env" | "db" | "none";
};

async function getDbSettings(): Promise<MetaOAuthSettings | null> {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", META_OAUTH_SETTINGS_KEY)
      .maybeSingle();
    return (data?.value as MetaOAuthSettings | null) ?? null;
  } catch {
    return null;
  }
}

export async function getMetaOAuthCredentials(): Promise<MetaOAuthCredentials> {
  const fromDb = await getDbSettings();
  const envId = process.env.META_APP_ID?.trim() ?? "";
  const envSecret = process.env.META_APP_SECRET?.trim() ?? "";
  const dbId = fromDb?.appId?.trim() ?? "";
  const dbSecret = fromDb?.appSecret?.trim() ?? "";

  if (fromDb?.enabled === false) {
    return { appId: "", appSecret: "", source: "none" };
  }

  const appId = envId || dbId;
  const appSecret = envSecret || dbSecret;

  if (appId && appSecret) {
    return {
      appId,
      appSecret,
      source: envId && envSecret ? "env" : "db",
    };
  }

  return { appId: "", appSecret: "", source: "none" };
}

export async function isMetaOAuthEnabled(): Promise<boolean> {
  const creds = await getMetaOAuthCredentials();
  return Boolean(creds.appId && creds.appSecret);
}

export async function saveMetaOAuthSettings(settings: MetaOAuthSettings): Promise<boolean> {
  const { error } = await supabaseAdmin.from("app_settings").upsert({
    key: META_OAUTH_SETTINGS_KEY,
    value: settings,
    updated_at: new Date().toISOString(),
  });
  return !error;
}
