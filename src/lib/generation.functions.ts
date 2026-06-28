// filepath: src/lib/generation.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logActivity } from "@/lib/activity.server";
import { processPendingGenerationJobs } from "@/lib/generation/jobProcessor.server";
import { resolveRequestedStoreCode } from "@/lib/storeContext.server";

const StoreCodeInput = z.object({ storeCode: z.string().trim().optional() });

const JobType = z.enum(["text", "image", "bulk_pack"]);

export type GenerationJobPublic = {
  id: string;
  storeCode: string;
  jobType: string;
  status: string;
  progress: number;
  batchId: string | null;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  draftId: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

function mapJob(row: {
  id: string;
  store_code: string;
  job_type: string;
  status: string;
  progress: number;
  batch_id: string | null;
  input: unknown;
  result: unknown;
  error_message: string | null;
  draft_id: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}): GenerationJobPublic {
  return {
    id: row.id,
    storeCode: row.store_code,
    jobType: row.job_type,
    status: row.status,
    progress: row.progress,
    batchId: row.batch_id,
    input: (row.input ?? {}) as Record<string, unknown>,
    result: row.result ? (row.result as Record<string, unknown>) : null,
    errorMessage: row.error_message,
    draftId: row.draft_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

const EnqueueInput = StoreCodeInput.extend({
  jobType: JobType,
  input: z.record(z.unknown()),
  priority: z.number().int().min(0).max(10).optional(),
  batchId: z.string().uuid().optional(),
});

export const enqueueGenerationJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EnqueueInput.parse(input))
  .handler(async ({ data, context }): Promise<{ job: GenerationJobPublic }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const { data: row, error } = await supabase
      .from("generation_jobs")
      .insert({
        store_code: storeCode,
        created_by: userId,
        job_type: data.jobType,
        input: data.input,
        priority: data.priority ?? 0,
        batch_id: data.batchId ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await logActivity(supabase, {
      actorId: userId,
      storeCode,
      action: "generation_enqueued",
      resourceType: "generation_job",
      resourceId: row.id,
      metadata: { jobType: data.jobType },
    });

    void triggerWorker();

    return { job: mapJob(row) };
  });

const BulkEnqueueInput = StoreCodeInput.extend({
  store: z.string().trim().min(1).max(120),
  industry: z.string().trim().max(80).optional().default(""),
  tone: z.array(z.string().max(20)).max(5).optional().default([]),
  keyword: z.string().trim().max(120).optional().default(""),
  channel: z.enum(["instagram", "tiktok", "naver", "kakao"]).optional().default("instagram"),
  variantCount: z.number().int().min(1).max(8).optional().default(5),
  includeImages: z.boolean().optional().default(true),
  imageStyle: z.string().max(200).optional(),
});

export const enqueueBulkGenerationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BulkEnqueueInput.parse(input))
  .handler(async ({ data, context }): Promise<{ job: GenerationJobPublic }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const { data: row, error } = await supabase
      .from("generation_jobs")
      .insert({
        store_code: storeCode,
        created_by: userId,
        job_type: "bulk_pack",
        priority: 5,
        input: {
          store: data.store,
          industry: data.industry,
          tone: data.tone,
          keyword: data.keyword,
          channel: data.channel,
          variantCount: data.variantCount,
          includeImages: data.includeImages,
          imageStyle: data.imageStyle,
        },
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await logActivity(supabase, {
      actorId: userId,
      storeCode,
      action: "bulk_generation_enqueued",
      resourceType: "generation_job",
      resourceId: row.id,
      metadata: { variantCount: data.variantCount },
    });

    void triggerWorker();

    return { job: mapJob(row) };
  });

export const listGenerationJobsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    StoreCodeInput.extend({
      status: z.enum(["pending", "claimed", "processing", "completed", "failed", "cancelled", "active"]).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }): Promise<{ jobs: GenerationJobPublic[] }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    let query = supabase
      .from("generation_jobs")
      .select("*")
      .eq("store_code", storeCode)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 30);

    if (data.status === "active") {
      query = query.in("status", ["pending", "claimed", "processing"]);
    } else if (data.status) {
      query = query.eq("status", data.status);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return { jobs: (rows ?? []).map(mapJob) };
  });

export const cancelGenerationJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: job, error: fetchErr } = await supabase
      .from("generation_jobs")
      .select("id, status, store_code")
      .eq("id", data.jobId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!job) throw new Error("작업을 찾을 수 없습니다.");
    if (job.status !== "pending") throw new Error("대기 중인 작업만 취소할 수 있습니다.");

    await resolveRequestedStoreCode(supabase, userId, job.store_code);

    const { error } = await supabase
      .from("generation_jobs")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", data.jobId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const retryGenerationJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: job, error: fetchErr } = await supabase
      .from("generation_jobs")
      .select("id, status, store_code")
      .eq("id", data.jobId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!job) throw new Error("작업을 찾을 수 없습니다.");
    if (!["failed", "cancelled"].includes(job.status)) {
      throw new Error("실패/취소된 작업만 재시도할 수 있습니다.");
    }

    await resolveRequestedStoreCode(supabase, userId, job.store_code);

    const { error } = await supabase
      .from("generation_jobs")
      .update({
        status: "pending",
        progress: 0,
        error_message: null,
        started_at: null,
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.jobId);
    if (error) throw new Error(error.message);

    void triggerWorker();
    return { ok: true };
  });

async function triggerWorker(): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await processPendingGenerationJobs(supabaseAdmin, 2);
  } catch (e) {
    console.error("[generation-worker] inline trigger failed:", e);
  }
}
