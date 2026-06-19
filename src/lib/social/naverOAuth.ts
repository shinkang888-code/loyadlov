/**
 * 네이버 로그인 OAuth + 블로그 Open API
 * @see https://developers.naver.com/docs/login/api/
 * @see https://openapi.naver.com/blog/writePost.json
 */

import { signSocialOAuthState } from "@/lib/social/oauthState";
import { getNaverOAuthCredentials } from "@/lib/social/naverOAuthSettings";

const NAVER_AUTHORIZE = "https://nid.naver.com/oauth2.0/authorize";
const NAVER_TOKEN = "https://nid.naver.com/oauth2.0/token";

export function getNaverRedirectUri(origin: string): string {
  const configured = process.env.NAVER_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${origin.replace(/\/$/, "")}/api/social/naver/oauth/callback`;
}

export async function buildNaverOAuthUrl(
  origin: string,
  loginId: string,
  storeCode: string
): Promise<string | null> {
  const creds = await getNaverOAuthCredentials();
  if (!creds.clientId || !creds.clientSecret) return null;

  const state = signSocialOAuthState({
    mode: "connect",
    platform: "naver_blog",
    loginId,
    storeCode,
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: creds.clientId,
    redirect_uri: getNaverRedirectUri(origin),
    state,
  });

  return `${NAVER_AUTHORIZE}?${params.toString()}`;
}

export async function exchangeNaverCode(
  origin: string,
  code: string,
  state: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
} | null> {
  const creds = await getNaverOAuthCredentials();
  if (!creds.clientId || !creds.clientSecret) return null;

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    code,
    state,
    redirect_uri: getNaverRedirectUri(origin),
  });

  const res = await fetch(`${NAVER_TOKEN}?${params.toString()}`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: string | number;
    error?: string;
  };
  if (!data.access_token || data.error) return null;

  const expiresIn = Number(data.expires_in) || 3600;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn,
  };
}

export async function refreshNaverAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const creds = await getNaverOAuthCredentials();
  if (!creds.clientId || !creds.clientSecret) return null;

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(`${NAVER_TOKEN}?${params.toString()}`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: string | number;
    error?: string;
  };
  if (!data.access_token || data.error) return null;
  return {
    accessToken: data.access_token,
    expiresIn: Number(data.expires_in) || 3600,
  };
}

export async function buildNaverApiHeaders(accessToken: string): Promise<Record<string, string> | null> {
  const creds = await getNaverOAuthCredentials();
  if (!creds.clientId || !creds.clientSecret) return null;
  return {
    Authorization: `Bearer ${accessToken}`,
    "X-Naver-Client-Id": creds.clientId,
    "X-Naver-Client-Secret": creds.clientSecret,
  };
}

export async function fetchNaverProfile(accessToken: string): Promise<{
  id: string;
  nickname: string;
  email?: string;
} | null> {
  const headers = await buildNaverApiHeaders(accessToken);
  if (!headers) return null;

  const res = await fetch("https://openapi.naver.com/v1/nid/me", { headers });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    resultcode?: string;
    message?: string;
    response?: { id?: string; nickname?: string; email?: string };
  };
  if (data.resultcode !== "00" || !data.response?.id) return null;
  return {
    id: data.response.id,
    nickname: data.response.nickname ?? data.response.id,
    email: data.response.email,
  };
}

export type NaverBlogCategory = {
  categoryNo: number;
  name: string;
};

export async function fetchNaverBlogCategories(
  accessToken: string
): Promise<NaverBlogCategory[]> {
  const headers = await buildNaverApiHeaders(accessToken);
  if (!headers) return [];

  const res = await fetch("https://openapi.naver.com/blog/listCategory.json", { headers });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    message?: { result?: { categoryList?: Array<{ categoryNo?: number; name?: string }> } };
  };
  const list = data.message?.result?.categoryList ?? [];
  return list
    .filter((c) => c.categoryNo != null)
    .map((c) => ({ categoryNo: c.categoryNo!, name: c.name ?? String(c.categoryNo) }));
}
