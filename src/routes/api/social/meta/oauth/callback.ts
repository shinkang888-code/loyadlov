import { createFileRoute } from "@tanstack/react-router";
import { verifySocialOAuthState } from "@/lib/social/oauthState";
import {
  exchangeMetaCode,
  exchangeMetaLongLivedToken,
  fetchMetaUserProfile,
} from "@/lib/social/metaOAuth";
import { buildMetaConnectionInfo } from "@/lib/social/metaProfile";
import { upsertSocialAccount } from "@/lib/social/socialAccountServer";
import { encryptToken } from "@/lib/social/tokenCrypto";

export const Route = createFileRoute("/api/social/meta/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const redirectBase = `${origin}/admin?tab=channels`;

        if (error) {
          return Response.redirect(
            `${redirectBase}&oauth=error&platform=meta&message=${encodeURIComponent(error)}`,
            302
          );
        }

        if (!code || !state) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=meta&message=missing_code`, 302);
        }

        const parsed = verifySocialOAuthState(state);
        if (!parsed) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=meta&message=invalid_state`, 302);
        }

        const short = await exchangeMetaCode(origin, code);
        if (!short) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=meta&message=token_exchange_failed`, 302);
        }

        const long = await exchangeMetaLongLivedToken(short.accessToken);
        const token = long ?? short;
        const profile = await fetchMetaUserProfile(token.accessToken);
        if (!profile) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=meta&message=profile_failed`, 302);
        }

        const expiresAt = new Date(Date.now() + token.expiresIn * 1000).toISOString();
        const connection = await buildMetaConnectionInfo(token.accessToken, profile.id, profile.name);

        const sharedMeta = {
          provider: "meta",
          facebookUserId: connection.facebookUserId,
          threadsUserId: connection.threadsUserId,
          threadsUsername: connection.threadsUsername,
          instagramBusinessAccountId: connection.instagramBusinessAccountId,
          pageId: connection.pageId,
          pageName: connection.pageName,
          pageAccessTokenEnc: connection.pageAccessToken ? encryptToken(connection.pageAccessToken) : null,
        };

        await upsertSocialAccount({
          storeCode: parsed.storeCode,
          platform: "instagram",
          platformUserId: connection.instagramBusinessAccountId ?? profile.id,
          displayName: connection.pageName ? `IG @${connection.pageName}` : profile.name,
          accessToken: token.accessToken,
          tokenExpiresAt: expiresAt,
          metadata: sharedMeta,
          connectedBy: parsed.loginId,
        });

        await upsertSocialAccount({
          storeCode: parsed.storeCode,
          platform: "threads",
          platformUserId: connection.threadsUserId ?? profile.id,
          displayName: connection.threadsUsername ? `@${connection.threadsUsername}` : profile.name,
          accessToken: token.accessToken,
          tokenExpiresAt: expiresAt,
          metadata: sharedMeta,
          connectedBy: parsed.loginId,
        });

        const warn =
          !connection.instagramBusinessAccountId || !connection.threadsUserId ? "&warn=partial" : "";

        return Response.redirect(`${redirectBase}&oauth=success&platform=meta${warn}`, 302);
      },
    },
  },
});
