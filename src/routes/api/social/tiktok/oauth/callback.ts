import { createFileRoute } from "@tanstack/react-router";
import { verifySocialOAuthState } from "@/lib/social/oauthState";
import { exchangeTikTokCode, fetchTikTokProfile } from "@/lib/social/tiktokOAuth";
import { upsertSocialAccount } from "@/lib/social/socialAccountServer";

export const Route = createFileRoute("/api/social/tiktok/oauth/callback")({
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
            `${redirectBase}&oauth=error&platform=tiktok&message=${encodeURIComponent(error)}`,
            302
          );
        }

        if (!code || !state) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=tiktok&message=missing_code`, 302);
        }

        const parsed = verifySocialOAuthState(state);
        if (!parsed) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=tiktok&message=invalid_state`, 302);
        }

        const tokens = await exchangeTikTokCode(origin, code);
        if (!tokens) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=tiktok&message=token_exchange_failed`, 302);
        }

        const profile = await fetchTikTokProfile(tokens.accessToken);
        const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

        await upsertSocialAccount({
          storeCode: parsed.storeCode,
          platform: "tiktok",
          platformUserId: tokens.openId,
          displayName: profile?.displayName ?? "TikTok",
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: expiresAt,
          metadata: { provider: "tiktok", openId: tokens.openId },
          connectedBy: parsed.loginId,
        });

        return Response.redirect(`${redirectBase}&oauth=success&platform=tiktok`, 302);
      },
    },
  },
});
