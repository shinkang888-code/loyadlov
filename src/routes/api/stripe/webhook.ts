import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveStripeCredentials } from "@/lib/platformSecrets.server";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const stripe = await resolveStripeCredentials();
        const raw = await request.text();
        const sig = request.headers.get("stripe-signature");

        if (stripe.webhookSecret && sig) {
          // 간단 검증: 프로덕션에서는 stripe SDK로 verify 권장
          const parts = Object.fromEntries(
            sig.split(",").map((p) => {
              const [k, v] = p.split("=");
              return [k, v];
            })
          );
          if (!parts.t) {
            return new Response("Invalid signature", { status: 400 });
          }
        }

        let event: { type?: string; data?: { object?: Record<string, unknown> } };
        try {
          event = JSON.parse(raw) as typeof event;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const obj = event.data?.object ?? {};
        const storeCode = String(obj.metadata?.store_code ?? obj.client_reference_id ?? "").trim();

        if (event.type === "checkout.session.completed" && storeCode) {
          await supabaseAdmin.from("subscriptions").upsert(
            {
              store_code: storeCode,
              plan: String(obj.metadata?.plan ?? "standard"),
              stripe_customer_id: String(obj.customer ?? ""),
              stripe_subscription_id: String(obj.subscription ?? ""),
              status: "active",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "store_code" }
          );
        }

        if (event.type === "customer.subscription.deleted" && storeCode) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "canceled", updated_at: new Date().toISOString() })
            .eq("store_code", storeCode);
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
