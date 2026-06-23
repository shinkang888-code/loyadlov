/**
 * Meta·YouTube OAuth 토큰 갱신
 */

import { getMetaOAuthCredentials } from "@/lib/social/metaOAuthSettings";
import { createGoogleOAuthClient } from "@/lib/googleOAuth.server";
import { getYouTubeRedirectUri } from "@/lib/social/youtubeOAuth";
import {
  listAccountsNeedingTokenRefresh,
  updateSocialAccountTokens,
} from "@/lib/social/socialAccountServer";
import { refreshNaverAccessToken } from "@/lib/social/naverOAuth";
import { decryptToken } from "@/lib/social/tokenCrypto";

export async function refreshExpiringSocialTokens(): Promise<{
  refreshed: number;
  failed: number;
  errors: string[];
}> {
  const accounts = await listAccountsNeedingTokenRefresh();
  let refreshed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    try {
      if (account.platform === "youtube" && account.refresh_token_enc) {
        const refreshToken = decryptToken(account.refresh_token_enc);
        if (!refreshToken) {
          failed++;
          errors.push(`${account.id}: refresh token 복호화 실패`);
          continue;
        }
        const { resolveAppUrl } = await import("@/lib/platformSecrets.server");
        const appOrigin = await resolveAppUrl("https://localhost");
        const client = await createGoogleOAuthClient(getYouTubeRedirectUri(appOrigin));
        if (!client) {
          failed++;
          continue;
        }
        client.setCredentials({ refresh_token: refreshToken });
        const { credentials } = await client.refreshAccessToken();
        if (!credentials.access_token) {
          failed++;
          errors.push(`${account.id}: YouTube token refresh 실패`);
          continue;
        }
        await updateSocialAccountTokens(account.id, {
          accessToken: credentials.access_token,
          refreshToken: credentials.refresh_token ?? refreshToken,
          tokenExpiresAt: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : null,
        });
        refreshed++;
      } else if (
        (account.platform === "instagram" || account.platform === "threads") &&
        account.access_token_enc
      ) {
        const accessToken = decryptToken(account.access_token_enc);
        if (!accessToken) {
          failed++;
          continue;
        }
        const creds = await getMetaOAuthCredentials();
        if (!creds.appId || !creds.appSecret) {
          failed++;
          continue;
        }
        const params = new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: creds.appId,
          client_secret: creds.appSecret,
          fb_exchange_token: accessToken,
        });
        const res = await fetch(
          `https://graph.facebook.com/v21.0/oauth/access_token?${params}`
        );
        const data = (await res.json()) as { access_token?: string; expires_in?: number };
        if (!data.access_token) {
          failed++;
          errors.push(`${account.id}: Meta token refresh 실패`);
          continue;
        }
        const expiresAt = new Date(
          Date.now() + (data.expires_in ?? 5184000) * 1000
        ).toISOString();
        await updateSocialAccountTokens(account.id, {
          accessToken: data.access_token,
          tokenExpiresAt: expiresAt,
        });
        refreshed++;
      } else if (account.platform === "naver_blog" && account.refresh_token_enc) {
        const refreshToken = decryptToken(account.refresh_token_enc);
        if (!refreshToken) {
          failed++;
          continue;
        }
        const refreshedToken = await refreshNaverAccessToken(refreshToken);
        if (!refreshedToken) {
          failed++;
          errors.push(`${account.id}: Naver token refresh 실패`);
          continue;
        }
        const expiresAt = new Date(
          Date.now() + refreshedToken.expiresIn * 1000
        ).toISOString();
        await updateSocialAccountTokens(account.id, {
          accessToken: refreshedToken.accessToken,
          tokenExpiresAt: expiresAt,
        });
        refreshed++;
      }
    } catch (e) {
      failed++;
      errors.push(`${account.id}: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  return { refreshed, failed, errors };
}

export async function publishDueScheduledPosts(origin: string): Promise<{
  published: number;
  failed: number;
  errors: string[];
}> {
  const { listDueScheduledPosts } = await import("@/lib/social/socialAccountServer");
  const { publishSocialPost } = await import("@/lib/social/socialPublishService");

  const posts = await listDueScheduledPosts();
  let published = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const post of posts) {
    const result = await publishSocialPost(post, origin);
    if (result.ok) published++;
    else {
      failed++;
      errors.push(`${post.id}: ${result.error}`);
    }
  }

  return { published, failed, errors };
}
