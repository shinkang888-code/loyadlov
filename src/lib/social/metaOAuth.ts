/**
 * Meta OAuth (Instagram + Threads) — Facebook Login
 */

import { signSocialOAuthState } from "@/lib/social/oauthState";
import { getMetaOAuthCredentials } from "@/lib/social/metaOAuthSettings";

const META_OAUTH_BASE = "https://www.facebook.com/v21.0/dialog/oauth";

export const META_OAUTH_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "threads_basic",
  "threads_content_publish",
  "business_management",
].join(",");

export function getMetaRedirectUri(origin: string): string {
  const configured = process.env.META_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${origin.replace(/\/$/, "")}/api/social/meta/oauth/callback`;
}

export async function isMetaOAuthConfiguredAsync(): Promise<boolean> {
  const creds = await getMetaOAuthCredentials();
  return Boolean(creds.appId && creds.appSecret);
}

export async function buildMetaOAuthUrl(
  origin: string,
  loginId: string,
  storeCode: string
): Promise<string | null> {
  const creds = await getMetaOAuthCredentials();
  if (!creds.appId || !creds.appSecret) return null;
  const redirectUri = getMetaRedirectUri(origin);
  const state = signSocialOAuthState({
    mode: "connect",
    platform: "meta",
    loginId,
    storeCode,
  });
  const params = new URLSearchParams({
    client_id: creds.appId,
    redirect_uri: redirectUri,
    scope: META_OAUTH_SCOPES,
    response_type: "code",
    state,
  });
  return `${META_OAUTH_BASE}?${params.toString()}`;
}

export async function exchangeMetaCode(
  origin: string,
  code: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const creds = await getMetaOAuthCredentials();
  if (!creds.appId || !creds.appSecret) return null;

  const redirectUri = getMetaRedirectUri(origin);
  const params = new URLSearchParams({
    client_id: creds.appId,
    client_secret: creds.appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 };
}

export async function exchangeMetaLongLivedToken(
  shortLivedToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const creds = await getMetaOAuthCredentials();
  if (!creds.appId || !creds.appSecret) return null;

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: creds.appId,
    client_secret: creds.appSecret,
    fb_exchange_token: shortLivedToken,
  });

  const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 5184000 };
}

export async function fetchMetaUserProfile(accessToken: string): Promise<{
  id: string;
  name: string;
} | null> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string; name?: string };
  if (!data.id) return null;
  return { id: data.id, name: data.name ?? "Meta User" };
}

export async function fetchInstagramBusinessAccount(
  accessToken: string,
  pageId: string
): Promise<string | null> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${encodeURIComponent(accessToken)}`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { instagram_business_account?: { id?: string } };
  return data.instagram_business_account?.id ?? null;
}