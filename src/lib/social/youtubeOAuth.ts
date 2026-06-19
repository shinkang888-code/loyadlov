import { createGoogleOAuthClient } from "@/lib/googleOAuth.server";
import { signSocialOAuthState } from "@/lib/social/oauthState";
import { isYouTubeOAuthEnabled } from "@/lib/social/youtubeOAuthSettings";

export const YOUTUBE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function getYouTubeRedirectUri(origin: string): string {
  const configured = process.env.YOUTUBE_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${origin.replace(/\/$/, "")}/api/social/youtube/oauth/callback`;
}

export async function isYouTubeOAuthConfigured(): Promise<boolean> {
  return isYouTubeOAuthEnabled();
}

export async function buildYouTubeOAuthUrl(
  origin: string,
  loginId: string,
  storeCode: string
): Promise<string | null> {
  if (!(await isYouTubeOAuthConfigured())) return null;
  const redirectUri = getYouTubeRedirectUri(origin);
  const client = await createGoogleOAuthClient(redirectUri);
  if (!client) return null;

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: YOUTUBE_OAUTH_SCOPES,
    state: signSocialOAuthState({
      mode: "connect",
      platform: "youtube",
      loginId,
      storeCode,
    }),
    include_granted_scopes: true,
  });
}

export async function exchangeYouTubeCode(
  origin: string,
  code: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number | null;
} | null> {
  const redirectUri = getYouTubeRedirectUri(origin);
  const client = await createGoogleOAuthClient(redirectUri);
  if (!client) return null;

  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) return null;

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiryDate: tokens.expiry_date ?? null,
  };
}

export async function fetchYouTubeChannel(accessToken: string): Promise<{
  channelId: string;
  title: string;
} | null> {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    items?: Array<{ id?: string; snippet?: { title?: string } }>;
  };
  const item = data.items?.[0];
  if (!item?.id) return null;
  return { channelId: item.id, title: item.snippet?.title ?? "YouTube Channel" };
}
