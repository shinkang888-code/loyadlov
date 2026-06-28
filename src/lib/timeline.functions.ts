// filepath: src/lib/timeline.functions.ts
/**
 * 통합 운영 타임라인 — 큐·활동·완료 작업을 timestamp 기준 단일 피드로 병합.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveRequestedStoreCode } from "@/lib/storeContext.server";
import type { ActivityItem, QueueItem } from "@/lib/profiles.functions";

export type TimelineEventKind =
  | "generation"
  | "schedule"
  | "social"
  | "draft"
  | "activity"
  | "verification";

export type TimelineEvent = {
  id: string;
  kind: TimelineEventKind;
  title: string;
  subtitle?: string;
  status: string;
  progress?: number;
  channel?: string;
  timestamp: string;
  meta?: Record<string, unknown>;
};

const StoreInput = z.object({
  storeCode: z.string().trim().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

function ts(value: string | null | undefined): number {
  return value ? new Date(value).getTime() : 0;
}

function queueToEvents(items: QueueItem[]): TimelineEvent[] {
  return items.map((item) => ({
    id: `${item.kind}:${item.id}`,
    kind:
      item.kind === "generation"
        ? "generation"
        : (item.kind as TimelineEventKind),
    title: item.title,
    status: item.status,
    progress: item.progress,
    channel: item.channel,
    timestamp: item.scheduledAt ?? item.createdAt,
  }));
}

function activityToEvents(items: ActivityItem[]): TimelineEvent[] {
  return items.map((a) => ({
    id: `activity:${a.id}`,
    kind: "activity" as const,
    title: a.action,
    subtitle: a.resourceType,
    status: "done",
    timestamp: a.createdAt,
    meta: a.metadata ?? {},
  }));
}

export async function buildUnifiedTimeline(
  supabase: Parameters<typeof resolveRequestedStoreCode>[0],
  storeCode: string,
  limit = 40,
): Promise<{ events: TimelineEvent[]; total: number }> {
  const [schedRes, socialRes, draftRes, genRes, genDoneRes, actRes] = await Promise.all([
    supabase
      .from("publish_schedule")
      .select("id, channel, status, scheduled_at, store_code, created_at")
      .eq("store_code", storeCode)
      .in("status", ["queued", "publishing", "failed"])
      .order("scheduled_at", { ascending: true })
      .limit(20),
    supabase
      .from("social_posts")
      .select("id, platform, status, scheduled_at, store_code, created_at, caption")
      .eq("store_code", storeCode)
      .in("status", ["scheduled", "draft", "publishing", "failed"])
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("content_drafts")
      .select("id, title, channel, status, store_code, created_at")
      .eq("store_code", storeCode)
      .in("status", ["draft", "review", "approved"])
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("generation_jobs")
      .select("id, job_type, status, progress, store_code, created_at, updated_at")
      .eq("store_code", storeCode)
      .in("status", ["pending", "claimed", "processing", "failed"])
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("generation_jobs")
      .select("id, job_type, status, progress, completed_at, updated_at, result")
      .eq("store_code", storeCode)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(10),
    supabase
      .from("activity_audit")
      .select("*")
      .eq("store_code", storeCode)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const err =
    schedRes.error?.message ??
    socialRes.error?.message ??
    draftRes.error?.message ??
    genRes.error?.message ??
    genDoneRes.error?.message ??
    actRes.error?.message;
  if (err) throw new Error(err);

  const queueItems: QueueItem[] = [
    ...(schedRes.data ?? []).map((r) => ({
      id: r.id,
      kind: "schedule" as const,
      title: `예약 발행 · ${r.channel}`,
      channel: r.channel,
      status: r.status,
      scheduledAt: r.scheduled_at,
      storeCode: r.store_code,
      createdAt: r.created_at,
    })),
    ...(socialRes.data ?? []).map((r) => {
      const caption = r.caption ?? "";
      return {
        id: r.id,
        kind: "social" as const,
        title: caption ? caption.slice(0, 40) + (caption.length > 40 ? "…" : "") : "소셜 게시물",
        channel: r.platform,
        status: r.status,
        scheduledAt: r.scheduled_at,
        storeCode: r.store_code,
        createdAt: r.created_at,
      };
    }),
    ...(draftRes.data ?? []).map((r) => ({
      id: r.id,
      kind: "draft" as const,
      title: r.title ?? "제목 없는 드래프트",
      channel: r.channel ?? "instagram",
      status: r.status,
      scheduledAt: null,
      storeCode: r.store_code,
      createdAt: r.created_at,
    })),
    ...(genRes.data ?? []).map((r) => ({
      id: r.id,
      kind: "generation" as const,
      title:
        r.job_type === "blog_draft"
          ? "블로그 원고 생성"
          : r.job_type === "media_gen"
            ? "미디어 생성"
            : r.job_type === "bulk_pack"
              ? "AI 대량 생성"
              : "AI 생성",
      channel: "ai",
      status: r.status,
      progress: r.progress,
      scheduledAt: null,
      storeCode: r.store_code,
      createdAt: r.created_at,
    })),
  ];

  const events: TimelineEvent[] = [
    ...queueToEvents(queueItems),
    ...(genDoneRes.data ?? []).map((r) => {
      const row = r as {
        id: string;
        job_type: string;
        status: string;
        progress: number;
        completed_at: string | null;
        updated_at: string;
        result: Record<string, unknown> | null;
      };
      const verification = row.result?.verification as { passed?: boolean } | undefined;
      return {
        id: `generation:done:${row.id}`,
        kind: (verification?.passed === false ? "verification" : "generation") as TimelineEventKind,
        title: row.job_type === "blog_draft" ? "블로그 원고 생성 완료" : "AI 생성 완료",
        status: row.status,
        progress: row.progress,
        channel: "ai",
        timestamp: row.completed_at ?? row.updated_at,
        meta: { verificationPassed: verification?.passed ?? true },
      };
    }),
    ...activityToEvents(
      (actRes.data ?? []).map((r) => ({
        id: r.id,
        action: r.action,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        metadata: (r.metadata ?? {}) as Record<string, string | number | boolean | null>,
        storeCode: r.store_code,
        createdAt: r.created_at,
      })),
    ),
  ];

  events.sort((a, b) => ts(b.timestamp) - ts(a.timestamp));
  return { events: events.slice(0, limit), total: events.length };
}

export const listUnifiedTimelineFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);
    return buildUnifiedTimeline(supabase, storeCode, data.limit ?? 40);
  });
