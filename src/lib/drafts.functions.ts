import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logActivity } from "@/lib/activity.server";
import { resolveRequestedStoreCode } from "@/lib/storeContext.server";

const Channel = z.enum(["instagram", "tiktok", "naver", "kakao"]);

const StoreCodeInput = z.object({ storeCode: z.string().trim().optional() });

const SaveInput = StoreCodeInput.extend({
  title: z.string().trim().max(200).optional().nullable(),
  body: z.string().trim().min(1).max(8000),
  hashtags: z.array(z.string().max(60)).max(30).optional().default([]),
  imageUrls: z.array(z.string().url()).max(10).optional().default([]),
  channel: Channel.optional().default("instagram"),
  aiModel: z.string().max(80).optional().nullable(),
});

export type SavedDraft = {
  id: string;
  store_code: string;
  title: string | null;
  body: string;
  hashtags: string[];
  image_urls: string[];
  channel: string | null;
  status: string;
  created_at: string;
};

export const saveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }): Promise<SavedDraft> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const { data: row, error } = await supabase
      .from("content_drafts")
      .insert({
        store_code: storeCode,
        created_by: userId,
        title: data.title ?? null,
        body: data.body,
        hashtags: data.hashtags,
        image_urls: data.imageUrls,
        channel: data.channel,
        ai_model: data.aiModel ?? null,
      })
      .select("id, store_code, title, body, hashtags, image_urls, channel, status, created_at")
      .single();
    if (error) throw new Error(error.message);

    await logActivity(supabase, {
      actorId: userId,
      storeCode,
      action: "draft_saved",
      resourceType: "content_draft",
      resourceId: row.id,
      metadata: { channel: data.channel },
    });

    return row as SavedDraft;
  });

export const listDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreCodeInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<SavedDraft[]> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const { data: rows, error } = await supabase
      .from("content_drafts")
      .select("id, store_code, title, body, hashtags, image_urls, channel, status, created_at")
      .eq("store_code", storeCode)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (rows ?? []) as SavedDraft[];
  });

const ScheduleInput = StoreCodeInput.extend({
  draftId: z.string().uuid(),
  channel: Channel,
  scheduledAt: z.string().datetime(),
});

export type ScheduleRow = {
  id: string;
  draft_id: string;
  channel: string;
  scheduled_at: string;
  status: string;
};

export const scheduleDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScheduleInput.parse(input))
  .handler(async ({ data, context }): Promise<ScheduleRow> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const { data: row, error } = await supabase
      .from("publish_schedule")
      .insert({
        draft_id: data.draftId,
        store_code: storeCode,
        channel: data.channel,
        scheduled_at: data.scheduledAt,
      })
      .select("id, draft_id, channel, scheduled_at, status")
      .single();
    if (error) throw new Error(error.message);
    return row as ScheduleRow;
  });

const RangeInput = StoreCodeInput.extend({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const listSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RangeInput.parse(input))
  .handler(async ({ data, context }): Promise<ScheduleRow[]> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const { data: rows, error } = await supabase
      .from("publish_schedule")
      .select("id, draft_id, channel, scheduled_at, status")
      .eq("store_code", storeCode)
      .gte("scheduled_at", data.from)
      .lte("scheduled_at", data.to)
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ScheduleRow[];
  });

export const unscheduleSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("publish_schedule")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getStoreDrivePathFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreCodeInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const storeCode = await resolveRequestedStoreCode(
      context.supabase,
      context.userId,
      data.storeCode
    );
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("business_name")
      .eq("store_code", storeCode)
      .limit(1)
      .maybeSingle();
    const name = prof?.business_name?.trim() || storeCode;
    const safeName = name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 40);
    return { path: `/${storeCode}_${safeName}/`, storeCode };
  });
