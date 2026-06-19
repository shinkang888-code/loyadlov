import { createFileRoute } from "@tanstack/react-router";
import { verifySocialOAuthState } from "@/lib/social/oauthState";
import { exchangeKakaoCode, fetchKakaoProfile } from "@/lib/social/kakaoOAuth";
import { upsertSocialAccount } from "@/lib/social/socialAccountServer";

export const Route = createFileRoute("/api/social/kakao/oauth/callback")({
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
            `${redirectBase}&oauth=error&platform=kakao&message=${encodeURIComponent(error)}`,
            302
          );
        }

        if (!code || !state) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=kakao&message=missing_code`, 302);
        }

        const parsed = verifySocialOAuthState(state);
        if (!parsed) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=kakao&message=invalid_state`, 302);
        }

        const tokens = await exchangeKakaoCode(origin, code);
        if (!tokens) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=kakao&message=token_exchange_failed`, 302);
        }

        const profile = await fetchKakaoProfile(tokens.accessToken);
        if (!profile) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=kakao&message=profile_failed`, 302);
        }

        const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

        await upsertSocialAccount({
          storeCode: parsed.storeCode,
          platform: "kakao",
          platformUserId: profile.id,
          displayName: profile.nickname,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: expiresAt,
          metadata: { provider: "kakao", kakaoId: profile.id },
          connectedBy: parsed.loginId,
        });

        return Response.redirect(`${redirectBase}&oauth=success&platform=kakao`, 302);
      },
    },
  },
});
