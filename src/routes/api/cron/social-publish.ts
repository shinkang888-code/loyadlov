import { createFileRoute } from "@tanstack/react-router";
import {
  publishDueScheduledPosts,
  refreshExpiringSocialTokens,
} from "@/lib/social/tokenRefreshService";

async function isCronAuthorized(request: Request): Promise<boolean> {
  const { resolveCronSecret } = await import("@/lib/platformSecrets.server");
  const secret = await resolveCronSecret();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

async function runCron(request: Request) {
  if (!(await isCronAuthorized(request))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { resolveAppUrl } = await import("@/lib/platformSecrets.server");
  const origin = (await resolveAppUrl()).replace(/\/$/, "") || new URL(request.url).origin;

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
