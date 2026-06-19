/**
 * TikTok Login Kit v2 OAuth
 * @see https://developers.tiktok.com/doc/login-kit-web/
 */

import { signSocialOAuthState } from "@/lib/social/oauthState";
import { getTikTokOAuthCredentials } from "@/lib/social/tiktokOAuthSettings";

const TIKTOK_AUTHORIZE = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN = "https://open.tiktokapis.com/v2/oauth/token/";

export const TIKTOK_OAUTH_SCOPES = ["user.info.basic", "video.publish"];

export function getTikTokRedirectUri(origin: string): string {
  const configured = process.env.TIKTOK_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${origin.replace(/\/$/, "")}/api/social/tiktok/oauth/callback`;
}

export async function buildTikTokOAuthUrl(
  origin: string,
  loginId: string,
  storeCode: string
): Promise<string | null> {
  const creds = await getTikTokOAuthCredentials();
  if (!creds.clientKey || !creds.clientSecret) return null;

  const state = signSocialOAuthState({
    mode: "connect",
    platform: "tiktok",
    loginId,
    storeCode,
  });

  const params = new URLSearchParams({
    client_key: creds.clientKey,
    scope: TIKTOK_OAUTH_SCOPES.join(","),
    response_type: "code",
    redirect_uri: getTikTokRedirectUri(origin),
    state,
  });

  return `${TIKTOK_AUTHORIZE}?${params.toString()}`;
}

export async function exchangeTikTokCode(
  origin: string,
  code: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  openId: string;
} | null> {
  const creds = await getTikTokOAuthCredentials();
  if (!creds.clientKey || !creds.clientSecret) return null;

  const body = new URLSearchParams({
    client_key: creds.clientKey,
    client_secret: creds.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: getTikTokRedirectUri(origin),
  });

  const res = await fetch(TIKTOK_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    open_id?: string;
    error?: string;
  };

  if (!data.access_token || !data.open_id || data.error) return null;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? 86400,
    openId: data.open_id,
  };
}

export async function fetchTikTokProfile(accessToken: string): Promise<{ displayName: string } | null> {
  const res = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    data?: { user?: { display_name?: string } };
  };
  const name = data.data?.user?.display_name?.trim();
  return { displayName: name || "TikTok User" };
}
