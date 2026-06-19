import { google } from "googleapis";
import { getYouTubeOAuthCredentials } from "@/lib/social/youtubeOAuthSettings";

export function getGoogleClientId(): string {
  return (
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ??
    process.env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim() ??
    ""
  );
}

export function getGoogleClientSecret(): string {
  return process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "";
}

/** @deprecated env-only; use isYouTubeOAuthEnabled() for DB+env check */
export function isGoogleOAuthConfigured(): boolean {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

export async function isGoogleOAuthConfiguredAsync(): Promise<boolean> {
  const creds = await getYouTubeOAuthCredentials();
  return Boolean(creds.clientId && creds.clientSecret);
}

export async function createGoogleOAuthClient(redirectUri: string) {
  const creds = await getYouTubeOAuthCredentials();
  if (!creds.clientId || !creds.clientSecret) return null;
  return new google.auth.OAuth2(creds.clientId, creds.clientSecret, redirectUri);
}
