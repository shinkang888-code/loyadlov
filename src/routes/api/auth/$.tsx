import { createFileRoute } from "@tanstack/react-router";
import { handleNeonAuthProxy } from "@/integrations/neon/auth-proxy.server";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: Object.fromEntries(
      METHODS.map((method) => [
        method,
        async ({ request, params }: { request: Request; params: { _splat?: string } }) => {
          const path = params._splat?.trim() || "get-session";
          return handleNeonAuthProxy(request, path);
        },
      ]),
    ),
  },
});
