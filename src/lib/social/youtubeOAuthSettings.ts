import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const YOUTUBE_OAUTH_SETTINGS_KEY = "youtube_oauth_settings";

export type YouTubeOAuthSettings = {
  clientId?: string;
  clientSecret?: string;
  enabled?: boolean;
};

export type YouTubeOAuthCredentials = {
  clientId: string;
  clientSecret: string;
  source: "env" | "db" | "none";
};

async function getDbSettings(): Promise<YouTubeOAuthSettings | null> {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", YOUTUBE_OAUTH_SETTINGS_KEY)
      .maybeSingle();
    return (data?.value as YouTubeOAuthSettings | null) ?? null;
  } catch {
    return null;
  }
}

export async function getYouTubeOAuthCredentials(): Promise<YouTubeOAuthCredentials> {
  const fromDb = await getDbSettings();
  const envId =
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ??
    process.env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim() ??
    "";
  const envSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "";
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

export async function isYouTubeOAuthEnabled(): Promise<boolean> {
  const creds = await getYouTubeOAuthCredentials();
  return Boolean(creds.clientId && creds.clientSecret);
}

export async function saveYouTubeOAuthSettings(settings: YouTubeOAuthSettings): Promise<boolean> {
  const { error } = await supabaseAdmin.from("app_settings").upsert({
    key: YOUTUBE_OAUTH_SETTINGS_KEY,
    value: settings,
    updated_at: new Date().toISOString(),
  });
  return !error;
}
