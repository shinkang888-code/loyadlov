// filepath: src/lib/kakao/consult.server.ts
// 카카오 상담 인입 처리 — 웹훅(상담톡/챗봇 skill/일반)에서 호출.
// service_role(supabaseAdmin)로 RLS 우회하여 기록한다.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

export type IngestInput = {
  storeCode: string;
  userKey: string;
  name?: string | null;
  content: string;
  msgType?: string;
  raw?: Record<string, unknown>;
};

export type ChannelSettings = {
  store_code: string;
  channel_public_id: string | null;
  channel_chat_url: string | null;
  chatbot_manage_url: string | null;
  webhook_token: string | null;
  bot_enabled: boolean;
  auto_reply: string | null;
  rest_api_key: string | null;
};

export async function getChannelSettings(storeCode: string): Promise<ChannelSettings | null> {
  const { data } = await supabaseAdmin
    .from("kakao_channel_settings")
    .select("*")
    .eq("store_code", storeCode)
    .maybeSingle();
  return (data as ChannelSettings | null) ?? null;
}

/** 인입 메시지를 상담 세션 + 메시지로 적재. consultationId 반환 */
export async function ingestIncomingMessage(input: IngestInput): Promise<string> {
  const now = new Date().toISOString();
  const preview = input.content.slice(0, 200);

  // 1) 기존 상담 세션 조회 (store + user_key 유니크)
  const { data: existing } = await supabaseAdmin
    .from("kakao_consultations")
    .select("id, status, unread_count, customer_name")
    .eq("store_code", input.storeCode)
    .eq("kakao_user_key", input.userKey)
    .maybeSingle();

  let consultationId: string;

  if (existing) {
    consultationId = existing.id;
    await supabaseAdmin
      .from("kakao_consultations")
      .update({
        last_message: preview,
        last_message_at: now,
        unread_count: (existing.unread_count ?? 0) + 1,
        // 종료된 상담에 새 메시지가 오면 다시 진행중으로 살린다.
        status: existing.status === "closed" ? "active" : existing.status,
        customer_name: existing.customer_name || input.name || null,
        updated_at: now,
      })
      .eq("id", consultationId);
  } else {
    const { data: created, error } = await supabaseAdmin
      .from("kakao_consultations")
      .insert({
        store_code: input.storeCode,
        kakao_user_key: input.userKey,
        customer_name: input.name || null,
        status: "new",
        last_message: preview,
        last_message_at: now,
        unread_count: 1,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "상담 세션 생성 실패");
    consultationId = created.id;
  }

  // 2) 메시지 적재
  await supabaseAdmin.from("kakao_messages").insert({
    consultation_id: consultationId,
    store_code: input.storeCode,
    direction: "in",
    content: input.content,
    msg_type: input.msgType ?? "text",
    raw: (input.raw ?? {}) as Json,
  });

  return consultationId;
}

/** 봇/상담원 발신 메시지 기록 */
export async function recordOutgoingMessage(opts: {
  consultationId: string;
  storeCode: string;
  content: string;
  msgType?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await supabaseAdmin.from("kakao_messages").insert({
    consultation_id: opts.consultationId,
    store_code: opts.storeCode,
    direction: "out",
    content: opts.content,
    msg_type: opts.msgType ?? "text",
  });
  await supabaseAdmin
    .from("kakao_consultations")
    .update({ last_message: opts.content.slice(0, 200), last_message_at: now, updated_at: now })
    .eq("id", opts.consultationId);
}
