import { createFileRoute } from "@tanstack/react-router";
import { processPendingGenerationJobs } from "@/lib/generation/jobProcessor.server";

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

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const summary = await processPendingGenerationJobs(supabaseAdmin, 5);

  return new Response(JSON.stringify({ ok: true, ...summary }), {
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/cron/generation-worker")({
  server: {
    handlers: {
      GET: async ({ request }) => runCron(request),
      POST: async ({ request }) => runCron(request),
    },
  },
});
