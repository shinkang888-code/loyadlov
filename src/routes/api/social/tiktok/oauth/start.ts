import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildTikTokOAuthUrl } from "@/lib/social/tiktokOAuth";
import { isTikTokOAuthConfigured } from "@/lib/social/socialAccountServer";
import { resolveOAuthStoreCode } from "@/lib/oauthStore.server";

export const Route = createFileRoute("/api/social/tiktok/oauth/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { data: claims, error } = await supabaseAdmin.auth.getClaims(token);
        if (error || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });

        const userId = claims.claims.sub as string;
        const email = (claims.claims.email as string) ?? userId;

        if (!(await isTikTokOAuthConfigured())) {
          return new Response("TikTok OAuth not configured", { status: 503 });
        }

        const storeCode = await resolveOAuthStoreCode(userId, url.searchParams.get("storeCode"));
        if (!storeCode) return new Response("Store code required", { status: 400 });

        const oauthUrl = await buildTikTokOAuthUrl(url.origin, email, storeCode);
        if (!oauthUrl) return new Response("OAuth URL failed", { status: 500 });

        return Response.redirect(oauthUrl, 302);
      },
    },
  },
});
