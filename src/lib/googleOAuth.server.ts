import { google } from "googleapis";

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

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

export async function createGoogleOAuthClient(redirectUri: string) {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}
