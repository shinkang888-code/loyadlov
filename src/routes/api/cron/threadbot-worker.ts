import { createFileRoute } from "@tanstack/react-router";
import { runThreadbotCronCycle } from "@/lib/threadbotWorker.server";

async function isCronAuthorized(request: Request): Promise<boolean> {
  const { resolveCronSecret } = await import("@/lib/platformSecrets.server");
  const secret = await resolveCronSecret();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

async function runCron() {
  const summary = await runThreadbotCronCycle();
  return new Response(JSON.stringify({ ok: true, ...summary }), {
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/cron/threadbot-worker")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isCronAuthorized(request))) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        return runCron();
      },
      POST: async ({ request }) => {
        if (!(await isCronAuthorized(request))) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        return runCron();
      },
    },
  },
});
