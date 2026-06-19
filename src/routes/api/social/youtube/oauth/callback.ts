import { createFileRoute } from "@tanstack/react-router";
import { verifySocialOAuthState } from "@/lib/social/oauthState";
import { upsertSocialAccount } from "@/lib/social/socialAccountServer";
import { exchangeYouTubeCode, fetchYouTubeChannel } from "@/lib/social/youtubeOAuth";

export const Route = createFileRoute("/api/social/youtube/oauth/callback")({
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
            `${redirectBase}&oauth=error&platform=youtube&message=${encodeURIComponent(error)}`,
            302
          );
        }

        if (!code || !state) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=youtube&message=missing_code`, 302);
        }

        const parsed = verifySocialOAuthState(state);
        if (!parsed) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=youtube&message=invalid_state`, 302);
        }

        const tokens = await exchangeYouTubeCode(origin, code);
        if (!tokens) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=youtube&message=token_exchange_failed`, 302);
        }

        const channel = await fetchYouTubeChannel(tokens.accessToken);
        if (!channel) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=youtube&message=channel_not_found`, 302);
        }

        const expiresAt = tokens.expiryDate ? new Date(tokens.expiryDate).toISOString() : null;

        await upsertSocialAccount({
          storeCode: parsed.storeCode,
          platform: "youtube",
          platformUserId: channel.channelId,
          displayName: channel.title,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: expiresAt,
          metadata: { channelId: channel.channelId },
          connectedBy: parsed.loginId,
        });

        return Response.redirect(`${redirectBase}&oauth=success&platform=youtube`, 302);
      },
    },
  },
});
