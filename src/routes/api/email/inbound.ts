// filepath: src/routes/api/email/inbound.ts
// 수신 이메일 웹훅 — Resend Inbound / 외부 메일 파서가 POST.
// ?store=<store_code> 필수. 발신자 이메일로 회원을 매칭(없으면 lead 회원 생성)해
// member_messages(channel=email, direction=in)로 적재한다.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type InboundPayload = {
  from?: string | { email?: string; name?: string };
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  // Resend inbound: { type, data: { from, subject, text, html } }
  data?: { from?: string; subject?: string; text?: string; html?: string };
};

function extractEmail(from: InboundPayload["from"]): { email: string; name: string } {
  if (!from) return { email: "", name: "" };
  if (typeof from === "object") return { email: from.email ?? "", name: from.name ?? "" };
  // "Name <a@b.com>" 또는 "a@b.com"
  const m = from.match(/^\s*(?:"?([^"<]*)"?\s*)?<?([^>\s]+@[^>\s]+)>?/);
  return { email: (m?.[2] ?? from).trim(), name: (m?.[1] ?? "").trim() };
}

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/email/inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const storeCode = (url.searchParams.get("store") ?? "").trim();
        if (!storeCode) return jsonRes({ error: "missing store" }, 400);

        let payload: InboundPayload;
        try {
          payload = (await request.json()) as InboundPayload;
        } catch {
          return jsonRes({ error: "invalid json" }, 400);
        }

        const d = payload.data ?? payload;
        const { email, name } = extractEmail(payload.from ?? payload.data?.from);
        const subject = d.subject ?? "(제목 없음)";
        const content = d.text ?? d.html ?? "";
        if (!email) return jsonRes({ error: "no sender" }, 400);

        // 회원 매칭 (이메일, 매장)
        const { data: found } = await supabaseAdmin
          .from("members")
          .select("id")
          .eq("store_code", storeCode)
          .ilike("email", email)
          .maybeSingle();

        let memberId = found?.id;
        if (!memberId) {
          const { data: created, error } = await supabaseAdmin
            .from("members")
            .insert({
              store_code: storeCode,
              name: name || email.split("@")[0],
              email,
              status: "lead",
              role: "member",
            })
            .select("id")
            .single();
          if (error || !created) return jsonRes({ error: error?.message ?? "create failed" }, 500);
          memberId = created.id;
        }

        const now = new Date().toISOString();
        await supabaseAdmin.from("member_messages").insert({
          member_id: memberId,
          store_code: storeCode,
          channel: "email",
          direction: "in",
          subject,
          content: content.slice(0, 20000),
          status: "received",
          meta: { raw_from: typeof payload.from === "string" ? payload.from : email },
        });
        await supabaseAdmin
          .from("members")
          .update({ last_contact_at: now, updated_at: now })
          .eq("id", memberId);

        return jsonRes({ ok: true, memberId });
      },
    },
  },
});
