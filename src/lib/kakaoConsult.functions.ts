// filepath: src/lib/kakaoConsult.functions.ts
// 카카오 상담채널 대시보드 서버 함수.
// 설정 CRUD / 상담 인박스 / 메시지 / 이름수정 / 상태 / 삭제 / 발송 기록.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveRequestedStoreCode } from "@/lib/storeContext.server";

const StoreInput = z.object({ storeCode: z.string().trim().optional() });

export type KakaoSettings = {
  storeCode: string;
  channelPublicId: string;
  channelChatUrl: string;
  chatbotManageUrl: string;
  webhookToken: string;
  botEnabled: boolean;
  autoReply: string;
  hasRestKey: boolean;
};

export type Consultation = {
  id: string;
  storeCode: string;
  kakaoUserKey: string;
  customerName: string | null;
  status: "new" | "active" | "pending" | "closed";
  channel: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConsultMessage = {
  id: string;
  consultationId: string;
  direction: "in" | "out";
  content: string | null;
  msgType: string;
  createdAt: string;
};

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type SettingsRow = {
  store_code: string;
  channel_public_id: string | null;
  channel_chat_url: string | null;
  chatbot_manage_url: string | null;
  webhook_token: string | null;
  bot_enabled: boolean;
  auto_reply: string | null;
  rest_api_key: string | null;
};

function mapSettings(row: SettingsRow): KakaoSettings {
  return {
    storeCode: row.store_code,
    channelPublicId: row.channel_public_id ?? "",
    channelChatUrl: row.channel_chat_url ?? "",
    chatbotManageUrl: row.chatbot_manage_url ?? "",
    webhookToken: row.webhook_token ?? "",
    botEnabled: row.bot_enabled ?? false,
    autoReply: row.auto_reply ?? "",
    hasRestKey: Boolean(row.rest_api_key),
  };
}

export const getKakaoSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreInput.parse(input))
  .handler(async ({ data, context }): Promise<{ settings: KakaoSettings }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const { data: row } = await supabase
      .from("kakao_channel_settings")
      .select("*")
      .eq("store_code", storeCode)
      .maybeSingle();

    if (row) return { settings: mapSettings(row as SettingsRow) };
    // 최초 진입 시 토큰을 발급해 즉시 저장한다.
    const token = randomToken();
    const { data: created } = await supabase
      .from("kakao_channel_settings")
      .insert({ store_code: storeCode, webhook_token: token, bot_enabled: false })
      .select("*")
      .single();
    return {
      settings: created
        ? mapSettings(created as SettingsRow)
        : {
            storeCode,
            channelPublicId: "",
            channelChatUrl: "",
            chatbotManageUrl: "",
            webhookToken: token,
            botEnabled: false,
            autoReply: "",
            hasRestKey: false,
          },
    };
  });

export const saveKakaoSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    StoreInput.extend({
      channelPublicId: z.string().trim().max(120).optional(),
      channelChatUrl: z.string().trim().max(500).optional(),
      chatbotManageUrl: z.string().trim().max(500).optional(),
      botEnabled: z.boolean().optional(),
      autoReply: z.string().max(1000).optional(),
      restApiKey: z.string().max(500).optional(),
      regenerateToken: z.boolean().optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }): Promise<{ settings: KakaoSettings }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const { data: existing } = await supabase
      .from("kakao_channel_settings")
      .select("webhook_token")
      .eq("store_code", storeCode)
      .maybeSingle();

    const token =
      data.regenerateToken || !existing?.webhook_token ? randomToken() : existing.webhook_token;

    const patch: Record<string, unknown> = {
      store_code: storeCode,
      webhook_token: token,
      updated_at: new Date().toISOString(),
    };
    if (data.channelPublicId !== undefined) patch.channel_public_id = data.channelPublicId || null;
    if (data.channelChatUrl !== undefined) patch.channel_chat_url = data.channelChatUrl || null;
    if (data.chatbotManageUrl !== undefined) patch.chatbot_manage_url = data.chatbotManageUrl || null;
    if (data.botEnabled !== undefined) patch.bot_enabled = data.botEnabled;
    if (data.autoReply !== undefined) patch.auto_reply = data.autoReply || null;
    if (data.restApiKey) patch.rest_api_key = data.restApiKey;

    const { data: row, error } = await supabase
      .from("kakao_channel_settings")
      .upsert(patch, { onConflict: "store_code" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { settings: mapSettings(row as SettingsRow) };
  });

type ConsultRow = {
  id: string;
  store_code: string;
  kakao_user_key: string;
  customer_name: string | null;
  status: string;
  channel: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

function mapConsult(row: ConsultRow): Consultation {
  return {
    id: row.id,
    storeCode: row.store_code,
    kakaoUserKey: row.kakao_user_key,
    customerName: row.customer_name,
    status: row.status as Consultation["status"],
    channel: row.channel,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    unreadCount: row.unread_count,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const listConsultationsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    StoreInput.extend({
      status: z.enum(["new", "active", "pending", "closed"]).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }): Promise<{ consultations: Consultation[] }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    let q = supabase
      .from("kakao_consultations")
      .select("*")
      .eq("store_code", storeCode)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(data.limit ?? 100);
    if (data.status) q = q.eq("status", data.status);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { consultations: (rows ?? []).map((r) => mapConsult(r as ConsultRow)) };
  });

export const getConsultMessagesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ consultationId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }): Promise<{ messages: ConsultMessage[] }> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("kakao_messages")
      .select("id, consultation_id, direction, content, msg_type, created_at")
      .eq("consultation_id", data.consultationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return {
      messages: (rows ?? []).map((r) => ({
        id: r.id,
        consultationId: r.consultation_id,
        direction: r.direction as "in" | "out",
        content: r.content,
        msgType: r.msg_type,
        createdAt: r.created_at,
      })),
    };
  });

export const renameConsultationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().max(120) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("kakao_consultations")
      .update({ customer_name: data.name || null, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateConsultationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "active", "pending", "closed"]).optional(),
        note: z.string().max(2000).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.status) patch.status = data.status;
    if (data.note !== undefined) patch.note = data.note || null;
    const { error } = await context.supabase
      .from("kakao_consultations")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markConsultationReadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("kakao_consultations")
      .update({ unread_count: 0 })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteConsultationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("kakao_consultations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendConsultMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    StoreInput.extend({
      consultationId: z.string().uuid(),
      content: z.string().trim().min(1).max(2000),
    }).parse(input)
  )
  .handler(async ({ data, context }): Promise<{ message: ConsultMessage }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);
    const now = new Date().toISOString();

    const { data: row, error } = await supabase
      .from("kakao_messages")
      .insert({
        consultation_id: data.consultationId,
        store_code: storeCode,
        direction: "out",
        content: data.content,
        msg_type: "agent",
      })
      .select("id, consultation_id, direction, content, msg_type, created_at")
      .single();
    if (error) throw new Error(error.message);

    await supabase
      .from("kakao_consultations")
      .update({
        last_message: data.content.slice(0, 200),
        last_message_at: now,
        status: "active",
        updated_at: now,
      })
      .eq("id", data.consultationId);

    return {
      message: {
        id: row.id,
        consultationId: row.consultation_id,
        direction: row.direction as "in" | "out",
        content: row.content,
        msgType: row.msg_type,
        createdAt: row.created_at,
      },
    };
  });
