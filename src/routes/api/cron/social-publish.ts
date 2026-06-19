import { createFileRoute } from "@tanstack/react-router";
import {
  publishDueScheduledPosts,
  refreshExpiringSocialTokens,
} from "@/lib/social/tokenRefreshService";

function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

async function runCron(request: Request) {
  if (!isCronAuthorized(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const origin =
    process.env.APP_URL?.trim()?.replace(/\/$/, "") || new URL(request.url).origin;

  const [refresh, publish] = await Promise.all([
    refreshExpiringSocialTokens(),
    publishDueScheduledPosts(origin),
  ]);

  return new Response(JSON.stringify({ ok: true, refresh, publish }), {
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/cron/social-publish")({
  server: {
    handlers: {
      GET: async ({ request }) => runCron(request),
      POST: async ({ request }) => runCron(request),
    },
  },
});
