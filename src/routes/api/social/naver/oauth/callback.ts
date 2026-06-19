import { createFileRoute } from "@tanstack/react-router";
import { verifySocialOAuthState } from "@/lib/social/oauthState";
import {
  exchangeNaverCode,
  fetchNaverBlogCategories,
  fetchNaverProfile,
} from "@/lib/social/naverOAuth";
import { upsertSocialAccount } from "@/lib/social/socialAccountServer";

export const Route = createFileRoute("/api/social/naver/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");
        const redirectBase = `${origin}/admin?tab=channels`;

        if (error) {
          return Response.redirect(
            `${redirectBase}&oauth=error&platform=naver&message=${encodeURIComponent(errorDescription ?? error)}`,
            302
          );
        }

        if (!code || !state) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=naver&message=missing_code`, 302);
        }

        const parsed = verifySocialOAuthState(state);
        if (!parsed) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=naver&message=invalid_state`, 302);
        }

        const tokens = await exchangeNaverCode(origin, code, state);
        if (!tokens) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=naver&message=token_exchange_failed`, 302);
        }

        const profile = await fetchNaverProfile(tokens.accessToken);
        if (!profile) {
          return Response.redirect(`${redirectBase}&oauth=error&platform=naver&message=profile_failed`, 302);
        }

        const categories = await fetchNaverBlogCategories(tokens.accessToken);
        const defaultCategory = categories[0]?.categoryNo ?? null;
        const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

        await upsertSocialAccount({
          storeCode: parsed.storeCode,
          platform: "naver_blog",
          platformUserId: profile.id,
          displayName: profile.nickname,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: expiresAt,
          metadata: {
            provider: "naver",
            email: profile.email,
            categories,
            defaultCategoryNo: defaultCategory,
          },
          connectedBy: parsed.loginId,
        });

        const warn = categories.length === 0 ? "&warn=no_blog" : "";
        return Response.redirect(`${redirectBase}&oauth=success&platform=naver${warn}`, 302);
      },
    },
  },
});
