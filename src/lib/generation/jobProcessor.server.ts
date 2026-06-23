// filepath: src/lib/generation/jobProcessor.server.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { logActivity } from "@/lib/activity.server";
import {
  buildImagePrompt,
  generateBlogDraft,
  generateImageContent,
  generateTextContent,
  type TextGenParams,
} from "@/lib/generation/aiCore.server";
import { normalizeCampaignInput } from "@/lib/blog/campaignInput";
import { buildTextMetrics } from "@/lib/blog/textMetrics";

type AdminClient = SupabaseClient<Database>;

export type GenerationJobRow = Database["public"]["Tables"]["generation_jobs"]["Row"];

type BulkPackInput = TextGenParams & {
  variantCount?: number;
  includeImages?: boolean;
  imageStyle?: string;
};

async function updateJobProgress(
  admin: AdminClient,
  jobId: string,
  progress: number,
  extra?: Partial<Database["public"]["Tables"]["generation_jobs"]["Update"]>
): Promise<void> {
  await admin
    .from("generation_jobs")
    .update({ progress, updated_at: new Date().toISOString(), ...extra })
    .eq("id", jobId);
}

async function failJob(admin: AdminClient, job: GenerationJobRow, message: string): Promise<void> {
  await admin
    .from("generation_jobs")
    .update({
      status: "failed",
      error_message: message.slice(0, 500),
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  await logActivity(admin, {
    actorId: job.created_by,
    storeCode: job.store_code,
    action: "generation_failed",
    resourceType: "generation_job",
    resourceId: job.id,
    metadata: { jobType: job.job_type, error: message.slice(0, 120) },
  });
}

async function completeJob(
  admin: AdminClient,
  job: GenerationJobRow,
  result: Record<string, unknown>,
  draftId?: string | null
): Promise<void> {
  await admin
    .from("generation_jobs")
    .update({
      status: "completed",
      progress: 100,
      result: result as Json,
      draft_id: draftId ?? null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  await logActivity(admin, {
    actorId: job.created_by,
    storeCode: job.store_code,
    action: "generation_completed",
    resourceType: "generation_job",
    resourceId: job.id,
    metadata: { jobType: job.job_type, draftId: draftId ?? null },
  });
}

async function createDraftFromGeneration(
  admin: AdminClient,
  job: GenerationJobRow,
  params: {
    body: string;
    hashtags: string[];
    imageUrls?: string[];
    channel?: string;
    aiModel?: string;
    title?: string;
  }
): Promise<string> {
  const { data, error } = await admin
    .from("content_drafts")
    .insert({
      store_code: job.store_code,
      created_by: job.created_by,
      title: params.title ?? null,
      body: params.body,
      hashtags: params.hashtags,
      image_urls: params.imageUrls ?? [],
      channel: (params.channel ?? "instagram") as Database["public"]["Enums"]["sns_channel"],
      ai_model: params.aiModel ?? null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

async function processTextJob(admin: AdminClient, job: GenerationJobRow): Promise<void> {
  const input = job.input as TextGenParams;
  await updateJobProgress(admin, job.id, 10);
  const text = await generateTextContent(input);
  await updateJobProgress(admin, job.id, 80);
  const draftId = await createDraftFromGeneration(admin, job, {
    body: text.body,
    hashtags: text.hashtags,
    channel: input.channel ?? "instagram",
    aiModel: text.model,
    title: input.keyword?.slice(0, 80) ?? null,
  });
  await completeJob(admin, job, { ...text, draftId }, draftId);
}

async function processBlogDraftJob(admin: AdminClient, job: GenerationJobRow): Promise<void> {
  const input = job.input as Record<string, unknown> & { writer?: string };
  await updateJobProgress(admin, job.id, 10);

  const campaign = normalizeCampaignInput(input);
  const draft = await generateBlogDraft(campaign, { writer: input.writer });
  await updateJobProgress(admin, job.id, 80);

  // 네이버 블로그 채널은 sns_channel enum 의 'naver' 로 저장한다.
  const body = `${draft.body}${draft.checklist.length ? `\n\n---\n반복 방지 키워드: ${draft.checklist.join(" / ")}` : ""}`;
  const draftId = await createDraftFromGeneration(admin, job, {
    body,
    hashtags: campaign.keywords,
    channel: "naver",
    aiModel: draft.model,
    title: draft.title.slice(0, 200),
  });

  const metrics = buildTextMetrics(draft.body, campaign);
  await completeJob(
    admin,
    job,
    {
      title: draft.title,
      body,
      source: draft.source,
      writer: input.writer ?? "기본 작가",
      metrics: {
        bodyCharsNoSpaces: metrics.bodyCharsNoSpaces,
        bodyTarget: metrics.bodyTarget,
        bodyPassed: metrics.bodyPassed,
        keywordReport: metrics.keywordReport,
      },
      draftId,
    },
    draftId
  );
}

async function processImageJob(admin: AdminClient, job: GenerationJobRow): Promise<void> {
  const input = job.input as {
    store: string;
    industry: string;
    keyword: string;
    styleHint?: string;
    linkDraftId?: string;
  };
  await updateJobProgress(admin, job.id, 15);
  const prompt = buildImagePrompt(input);
  const image = await generateImageContent(prompt);
  await updateJobProgress(admin, job.id, 85);

  const draftId = input.linkDraftId ?? null;
  if (draftId) {
    const { data: draft } = await admin
      .from("content_drafts")
      .select("image_urls")
      .eq("id", draftId)
      .maybeSingle();
    const existing = Array.isArray(draft?.image_urls) ? draft.image_urls : [];
    await admin
      .from("content_drafts")
      .update({ image_urls: [...existing, image.dataUrl].slice(0, 10) })
      .eq("id", draftId);
  }

  await completeJob(admin, job, { dataUrl: image.dataUrl, model: image.model, draftId }, draftId);
}

async function processBulkPackJob(admin: AdminClient, job: GenerationJobRow): Promise<void> {
  const input = job.input as BulkPackInput;
  const count = Math.min(Math.max(input.variantCount ?? 5, 1), 8);
  const includeImages = input.includeImages !== false;
  const variants: Array<{
    draftId: string;
    body: string;
    hashtags: string[];
    imageUrl?: string;
  }> = [];

  for (let i = 0; i < count; i++) {
    const slice = includeImages ? 50 : 100;
    const baseProgress = Math.floor((i / count) * slice);
    await updateJobProgress(admin, job.id, baseProgress);

    const keyword = input.keyword
      ? `${input.keyword} (변형 ${i + 1})`
      : `오늘의 메뉴 (변형 ${i + 1})`;

    const text = await generateTextContent({
      store: input.store,
      industry: input.industry,
      tone: input.tone,
      keyword,
      channel: input.channel,
    });

    const midProgress = baseProgress + Math.floor(slice / count / 2);
    await updateJobProgress(admin, job.id, midProgress);

    let imageUrl: string | undefined;
    if (includeImages) {
      const prompt = buildImagePrompt({
        store: input.store,
        industry: input.industry ?? "미분류",
        keyword,
        styleHint: input.imageStyle,
      });
      const image = await generateImageContent(prompt);
      imageUrl = image.dataUrl;
    }

    const draftId = await createDraftFromGeneration(admin, job, {
      body: text.body,
      hashtags: text.hashtags,
      imageUrls: imageUrl ? [imageUrl] : [],
      channel: input.channel ?? "instagram",
      aiModel: text.model,
      title: `대량 생성 #${i + 1}`,
    });

    variants.push({
      draftId,
      body: text.body,
      hashtags: text.hashtags,
      imageUrl,
    });

    const doneProgress = includeImages
      ? 50 + Math.floor(((i + 1) / count) * 50)
      : Math.floor(((i + 1) / count) * 100);
    await updateJobProgress(admin, job.id, doneProgress);
  }

  await completeJob(admin, job, { variants, count: variants.length }, variants[0]?.draftId ?? null);
}

export async function processGenerationJob(
  admin: AdminClient,
  job: GenerationJobRow
): Promise<void> {
  try {
    if (job.job_type === "text") {
      await processTextJob(admin, job);
    } else if (job.job_type === "image") {
      await processImageJob(admin, job);
    } else if (job.job_type === "bulk_pack") {
      await processBulkPackJob(admin, job);
    } else if (job.job_type === "blog_draft") {
      await processBlogDraftJob(admin, job);
    } else {
      await failJob(admin, job, `Unknown job type: ${job.job_type}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    await failJob(admin, job, msg);
  }
}

export type ProcessJobsSummary = {
  claimed: number;
  completed: number;
  failed: number;
};

export async function processPendingGenerationJobs(
  admin: AdminClient,
  limit = 3
): Promise<ProcessJobsSummary> {
  const { data: jobs, error } = await admin.rpc("claim_generation_jobs", { p_limit: limit });
  if (error) throw new Error(error.message);

  const claimed = jobs ?? [];
  let completed = 0;
  let failed = 0;

  for (const job of claimed) {
    await processGenerationJob(admin, job);
    const { data: updated } = await admin
      .from("generation_jobs")
      .select("status")
      .eq("id", job.id)
      .maybeSingle();
    if (updated?.status === "completed") completed++;
    else if (updated?.status === "failed") failed++;
  }

  return { claimed: claimed.length, completed, failed };
}
