/**
 * Kakao Login OAuth
 * @see https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api
 */

import { signSocialOAuthState } from "@/lib/social/oauthState";
import { getKakaoOAuthCredentials } from "@/lib/social/kakaoOAuthSettings";

const KAKAO_AUTHORIZE = "https://kauth.kakao.com/oauth/authorize";
const KAKAO_TOKEN = "https://kauth.kakao.com/oauth/token";

export function getKakaoRedirectUri(origin: string): string {
  const configured = process.env.KAKAO_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${origin.replace(/\/$/, "")}/api/social/kakao/oauth/callback`;
}

export async function buildKakaoOAuthUrl(
  origin: string,
  loginId: string,
  storeCode: string
): Promise<string | null> {
  const creds = await getKakaoOAuthCredentials();
  if (!creds.restApiKey || !creds.clientSecret) return null;

  const state = signSocialOAuthState({
    mode: "connect",
    platform: "kakao",
    loginId,
    storeCode,
  });

  const params = new URLSearchParams({
    client_id: creds.restApiKey,
    redirect_uri: getKakaoRedirectUri(origin),
    response_type: "code",
    scope: "profile_nickname,talk_message",
    state,
  });

  return `${KAKAO_AUTHORIZE}?${params.toString()}`;
}

export async function exchangeKakaoCode(
  origin: string,
  code: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
} | null> {
  const creds = await getKakaoOAuthCredentials();
  if (!creds.restApiKey || !creds.clientSecret) return null;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: creds.restApiKey,
    client_secret: creds.clientSecret,
    redirect_uri: getKakaoRedirectUri(origin),
    code,
  });

  const res = await fetch(KAKAO_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!data.access_token || data.error) return null;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? 21600,
  };
}

export async function fetchKakaoProfile(accessToken: string): Promise<{
  id: string;
  nickname: string;
} | null> {
  const res = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    id?: number;
    properties?: { nickname?: string };
  };
  if (!data.id) return null;
  return {
    id: String(data.id),
    nickname: data.properties?.nickname?.trim() || "Kakao User",
  };
}
