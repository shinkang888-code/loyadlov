import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildYouTubeOAuthUrl } from "@/lib/social/youtubeOAuth";
import { isYouTubeOAuthConfigured } from "@/lib/social/socialAccountServer";

export const Route = createFileRoute("/api/social/youtube/oauth/start")({
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

        if (!(await isYouTubeOAuthConfigured())) {
          return new Response("YouTube OAuth not configured", { status: 503 });
        }

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("store_code")
          .eq("id", userId)
          .maybeSingle();

        const storeCode = profile?.store_code?.trim();
        if (!storeCode) return new Response("Store code required", { status: 400 });

        const oauthUrl = await buildYouTubeOAuthUrl(url.origin, email, storeCode);
        if (!oauthUrl) return new Response("OAuth URL failed", { status: 500 });

        return Response.redirect(oauthUrl, 302);
      },
    },
  },
});
