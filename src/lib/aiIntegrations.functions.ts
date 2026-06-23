// filepath: src/lib/aiIntegrations.functions.ts
/**
 * AI · 미디어 생성 연동 서버 함수 — 관리자 콘솔 'API 연동' 패널 백엔드.
 * 상태 조회 / 연결 테스트 / 통합 텍스트 생성 / 미디어 생성 큐.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canManagePlatformSettings } from "@/lib/platformAuth.server";
import { getAiIntegrationStatus } from "@/lib/platformSecrets.server";
import { logActivity } from "@/lib/activity.server";
import { processPendingGenerationJobs } from "@/lib/generation/jobProcessor.server";
import { resolveRequestedStoreCode } from "@/lib/storeContext.server";

const PROVIDERS = [
  "gemini",
  "openai",
  "higgsfield",
  "figma",
  "canva",
] as const;
type TestableProvider = (typeof PROVIDERS)[number];

export const getAiIntegrationStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const canEdit = await canManagePlatformSettings(context.supabase, context.userId);
    const status = await getAiIntegrationStatus();
    return { canEdit, status };
  });

export const testAiIntegrationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ provider: z.enum(PROVIDERS) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const canEdit = await canManagePlatformSettings(context.supabase, context.userId);
    if (!canEdit) throw new Error("연결 테스트는 소유자(owner)/관리자(admin)만 가능합니다.");

    const provider = data.provider as TestableProvider;
    let result: { ok: boolean; message: string };
    switch (provider) {
      case "gemini": {
        const { testGemini } = await import("@/lib/integrations/gemini.server");
        result = await testGemini();
        break;
      }
      case "openai": {
        const { testOpenAi } = await import("@/lib/integrations/openai.server");
        result = await testOpenAi();
        break;
      }
      case "higgsfield": {
        const { testHiggsfield } = await import("@/lib/integrations/higgsfield.server");
        result = await testHiggsfield();
        break;
      }
      case "figma": {
        const { testFigma } = await import("@/lib/integrations/figma.server");
        result = await testFigma();
        break;
      }
      case "canva": {
        const { testCanva } = await import("@/lib/integrations/canva.server");
        result = await testCanva();
        break;
      }
      default:
        result = { ok: false, message: "지원하지 않는 프로바이더" };
    }
    return { provider, ...result };
  });

export const generateTextWithProviderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        provider: z.enum(["lovable", "gemini", "openai"]),
        prompt: z.string().trim().min(1).max(8000),
        system: z.string().max(4000).optional(),
        model: z.string().max(120).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const { generateText } = await import("@/lib/integrations/llm.server");
    const result = await generateText(data);
    return result;
  });

async function triggerWorker(): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await processPendingGenerationJobs(supabaseAdmin, 1);
  } catch (e) {
    console.error("[media-worker] inline trigger failed:", e);
  }
}

export const enqueueMediaGenFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeCode: z.string().trim().optional(),
        provider: z.enum(["higgsfield"]).default("higgsfield"),
        kind: z.enum(["image", "video"]).default("image"),
        prompt: z.string().trim().min(1).max(2000),
        imageUrl: z.string().url().max(2000).optional(),
        size: z.string().max(20).optional(),
        quality: z.string().max(20).optional(),
        batchSize: z.number().int().min(1).max(4).optional(),
        model: z.string().max(40).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const jobInput = {
      provider: data.provider,
      kind: data.kind,
      prompt: data.prompt,
      imageUrl: data.imageUrl,
      size: data.size,
      quality: data.quality,
      batchSize: data.batchSize,
      model: data.model,
    };
    const { data: row, error } = await supabase
      .from("generation_jobs")
      .insert({
        store_code: storeCode,
        created_by: userId,
        job_type: "media_gen",
        priority: 5,
        input: jobInput,
      })
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);

    await logActivity(supabase, {
      actorId: userId,
      storeCode,
      action: "media_gen_enqueued",
      resourceType: "generation_job",
      resourceId: row.id,
      metadata: { provider: data.provider, kind: data.kind },
    });

    void triggerWorker();
    return { jobId: row.id, status: row.status };
  });

export const getMediaJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ jobId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("generation_jobs")
      .select("id, status, progress, error_message, result")
      .eq("id", data.jobId)
      .maybeSingle();
    return row ?? null;
  });

export const listMediaAssetsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ storeCode: z.string().trim().optional(), limit: z.number().int().min(1).max(60).optional() })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);
    const { data: rows } = await supabase
      .from("media_assets")
      .select("id, provider, kind, prompt, url, thumb_url, created_at")
      .eq("store_code", storeCode)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 24);
    return rows ?? [];
  });
