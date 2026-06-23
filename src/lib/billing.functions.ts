import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveRequestedStoreCode } from "@/lib/storeContext.server";
import { resolveAppUrl, resolveStripeCredentials } from "@/lib/platformSecrets.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CheckoutInput = z.object({
  plan: z.enum(["standard", "premium"]),
  storeCode: z.string().trim().optional(),
});

export const createStripeCheckoutFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckoutInput.parse(input))
  .handler(async ({ data, context }) => {
    const storeCode = await resolveRequestedStoreCode(
      context.supabase,
      context.userId,
      data.storeCode
    );
    const stripe = await resolveStripeCredentials();
    if (!stripe.secretKey) {
      throw new Error("Stripe Secret Key가 설정되지 않았습니다. Admin → 설정 → 결제 탭에서 입력하세요.");
    }
    const priceId =
      data.plan === "premium" ? stripe.pricePremium : stripe.priceStandard;
    if (!priceId) {
      throw new Error(
        `Stripe Price ID(${data.plan})가 설정되지 않았습니다. Stripe 대시보드에서 가격 ID를 복사해 설정하세요.`
      );
    }

    const appUrl = await resolveAppUrl();
    const body = new URLSearchParams({
      mode: "subscription",
      success_url: `${appUrl}/admin?tab=settings&billing=success`,
      cancel_url: `${appUrl}/admin?tab=settings&billing=cancel`,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      client_reference_id: storeCode,
      "metadata[store_code]": storeCode,
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripe.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Stripe Checkout 생성 실패: ${err.slice(0, 200)}`);
    }

    const session = (await res.json()) as { url?: string; id?: string };
    if (!session.url) throw new Error("Checkout URL을 받지 못했습니다.");

    await supabaseAdmin.from("subscriptions").upsert(
      {
        store_code: storeCode,
        plan: data.plan,
        status: "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "store_code" }
    );

    return { url: session.url, sessionId: session.id };
  });

export const getSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storeCode: z.string().trim().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const storeCode = await resolveRequestedStoreCode(
      context.supabase,
      context.userId,
      data.storeCode
    );
    const { data: row } = await context.supabase
      .from("subscriptions")
      .select("plan, status, current_period_end, stripe_customer_id")
      .eq("store_code", storeCode)
      .maybeSingle();
    const stripe = await resolveStripeCredentials();
    return {
      subscription: row ?? { plan: "standard", status: "inactive" },
      stripeConfigured: Boolean(stripe.secretKey && stripe.publishableKey),
      publishableKey: stripe.publishableKey ?? null,
    };
  });
