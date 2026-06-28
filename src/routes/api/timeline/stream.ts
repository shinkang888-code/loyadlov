// filepath: src/routes/api/timeline/stream.ts
/**
 * SSE 타임라인 스트림 (폴링 대체 — Bearer 토큰 query 또는 Authorization 헤더)
 */
import { createFileRoute } from "@tanstack/react-router";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { NEON_AUTH_JWKS_URL } from "@/integrations/neon/auth-config";
import { getNeonDb } from "@/integrations/neon/supabase-compat.server";
import { buildUnifiedTimeline } from "@/lib/timeline.functions";
import { resolveRequestedStoreCode } from "@/lib/storeContext.server";

const JWKS = createRemoteJWKSet(new URL(NEON_AUTH_JWKS_URL));

async function verifyRequest(request: Request): Promise<{ userId: string } | null> {
  const url = new URL(request.url);
  const qToken = url.searchParams.get("token")?.trim();
  const header = request.headers.get("authorization");
  const token = qToken || (header?.startsWith("Bearer ") ? header.slice(7).trim() : "");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS);
    if (!payload.sub) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/timeline/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await verifyRequest(request);
        if (!auth) {
          return new Response("Unauthorized", { status: 401 });
        }

        const url = new URL(request.url);
        const storeCodeParam = url.searchParams.get("store")?.trim();
        const db = getNeonDb();

        let storeCode: string;
        try {
          storeCode = await resolveRequestedStoreCode(db, auth.userId, storeCodeParam);
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "Forbidden", { status: 403 });
        }

        const encoder = new TextEncoder();
        let closed = false;

        const stream = new ReadableStream({
          start(controller) {
            const send = (event: string, data: unknown) => {
              if (closed) return;
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };

            const tick = async () => {
              if (closed) return;
              try {
                const snap = await buildUnifiedTimeline(db, storeCode, 30);
                send("timeline", snap);
              } catch (e) {
                send("error", { message: e instanceof Error ? e.message : "stream error" });
              }
            };

            void tick();
            const interval = setInterval(() => void tick(), 4000);

            request.signal.addEventListener("abort", () => {
              closed = true;
              clearInterval(interval);
              controller.close();
            });
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
