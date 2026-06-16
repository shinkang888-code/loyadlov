import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Channel = z.enum(["instagram", "tiktok", "naver", "kakao"]);

const SaveInput = z.object({
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
    const { supabase } = context;
    const { data: prof, error: pe } = await supabase
      .from("profiles")
      .select("store_code")
      .single();
    if (pe || !prof?.store_code) throw new Error("매장 코드를 먼저 등록해주세요.");

    const { data: row, error } = await supabase
      .from("content_drafts")
      .insert({
        store_code: prof.store_code,
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
    return row as SavedDraft;
  });

export const listDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavedDraft[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("content_drafts")
      .select("id, store_code, title, body, hashtags, image_urls, channel, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []) as SavedDraft[];
  });

const ScheduleInput = z.object({
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
    const { supabase } = context;
    const { data: prof } = await supabase.from("profiles").select("store_code").single();
    if (!prof?.store_code) throw new Error("매장 코드 누락");

    const { data: row, error } = await supabase
      .from("publish_schedule")
      .insert({
        draft_id: data.draftId,
        store_code: prof.store_code,
        channel: data.channel,
        scheduled_at: data.scheduledAt,
      })
      .select("id, draft_id, channel, scheduled_at, status")
      .single();
    if (error) throw new Error(error.message);
    return row as ScheduleRow;
  });

const RangeInput = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const listSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RangeInput.parse(input))
  .handler(async ({ data, context }): Promise<ScheduleRow[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("publish_schedule")
      .select("id, draft_id, channel, scheduled_at, status")
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
