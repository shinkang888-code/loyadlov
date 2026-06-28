// filepath: src/lib/generation/jobProcessor.server.ts
import type { NeonDbClient } from "@/integrations/neon/supabase-compat.server";
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
import { buildVerificationFailureMessage } from "@/lib/blog/draftVerification";
import { buildTextMetrics } from "@/lib/blog/textMetrics";

type AdminClient = NeonDbClient;

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
  const resultPayload = {
    title: draft.title,
    body,
    source: draft.source,
    writer: input.writer ?? "기본 작가",
    verificationPassed: draft.verificationPassed,
    verification: draft.verification,
    metrics: {
      bodyCharsNoSpaces: metrics.bodyCharsNoSpaces,
      bodyTarget: metrics.bodyTarget,
      bodyPassed: metrics.bodyPassed,
      keywordReport: metrics.keywordReport,
    },
    draftId,
  };

  if (!draft.verificationPassed) {
    await admin
      .from("generation_jobs")
      .update({
        status: "failed",
        progress: 100,
        error_message: buildVerificationFailureMessage(draft.verification),
        result: resultPayload as Json,
        draft_id: draftId,
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
      metadata: {
        jobType: job.job_type,
        error: "verification_failed",
        verification: draft.verification,
      },
    });
    return;
  }

  await completeJob(admin, job, resultPayload, draftId);
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

type MediaGenInput = {
  provider?: string;
  kind?: "image" | "video" | "cardnews";
  prompt?: string;
  imageUrl?: string;
  size?: string;
  quality?: string;
  batchSize?: number;
  model?: string;
  // 카드뉴스
  topic?: string;
  slideCount?: number;
  style?: string;
  // Figma 템플릿
  figmaFileKey?: string;
  figmaNodeIds?: string[];
};

async function insertMediaAssets(
  admin: AdminClient,
  job: GenerationJobRow,
  provider: string,
  kind: string,
  items: { url: string; prompt?: string; meta?: Record<string, unknown> }[]
): Promise<void> {
  if (!items.length) return;
  const rows = items.map((it) => ({
    store_code: job.store_code,
    created_by: job.created_by,
    provider,
    kind,
    prompt: (it.prompt ?? "").slice(0, 2000),
    url: it.url,
    job_id: job.id,
    meta: (it.meta ?? {}) as Json,
  }));
  const { error } = await admin.from("media_assets").insert(rows);
  if (error) throw new Error(error.message);
}

/** 카드뉴스 슬라이드 텍스트를 LLM으로 생성 */
async function generateSlideTexts(
  topic: string,
  count: number
): Promise<{ title: string; body: string }[]> {
  const { generateText } = await import("@/lib/integrations/llm.server");
  const { resolveGeminiApiKey } = await import("@/lib/platformSecrets.server");
  const provider = (await resolveGeminiApiKey()) ? "gemini" : "lovable";

  const system =
    "너는 한국어 카드뉴스 기획자다. 주제를 받아 슬라이드별 짧은 제목과 1~2문장 본문을 만든다. " +
    'JSON만 출력: {"slides":[{"title":string,"body":string}]} (백틱/설명 금지).';
  const user = `주제: ${topic}\n슬라이드 수: ${count}장 (1장=표지, 마지막=요약/CTA). 제목은 12자 이내, 본문은 60자 이내.`;

  try {
    const { text } = await generateText({ provider, prompt: user, system });
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as { slides?: { title?: string; body?: string }[] };
    const slides = (parsed.slides ?? [])
      .map((s) => ({ title: String(s.title ?? "").trim(), body: String(s.body ?? "").trim() }))
      .filter((s) => s.title || s.body)
      .slice(0, count);
    if (slides.length) return slides;
  } catch {
    /* fall through to fallback */
  }
  // 폴백: 단순 분할
  return Array.from({ length: count }, (_, i) => ({
    title: i === 0 ? topic : `${topic} ${i + 1}`,
    body: "",
  }));
}

function buildCardNewsPrompt(
  slide: { title: string; body: string },
  index: number,
  total: number,
  style?: string
): string {
  const styleHint = style?.trim() || "모던하고 깔끔한 미니멀 디자인, 부드러운 그라데이션 배경";
  return [
    `한국어 카드뉴스 ${index + 1}/${total}번째 슬라이드, 1:1 정사각형 SNS 카드뉴스.`,
    `큰 제목 텍스트: "${slide.title}".`,
    slide.body ? `부제/본문 텍스트: "${slide.body}".` : "",
    `스타일: ${styleHint}. 가독성 높은 한글 타이포그래피, 여백 충분히, 고대비, 통일된 컬러 팔레트.`,
  ]
    .filter(Boolean)
    .join(" ");
}

async function generateOneImage(
  provider: string,
  prompt: string,
  opts: { size?: string; quality?: string; model?: string }
): Promise<string> {
  if (provider === "gemini") {
    const { generateGeminiImage } = await import("@/lib/integrations/gemini.server");
    const r = await generateGeminiImage(prompt, { model: opts.model });
    return r.dataUrl;
  }
  // 기본: Higgsfield
  const { generateHiggsfieldImage } = await import("@/lib/integrations/higgsfield.server");
  const r = await generateHiggsfieldImage({
    prompt,
    size: opts.size,
    quality: opts.quality,
    batchSize: 1,
  });
  if (!r.urls.length) throw new Error("이미지 생성 결과가 비어 있습니다 (안전 필터/시간 초과).");
  return r.urls[0];
}

async function processMediaGenJob(admin: AdminClient, job: GenerationJobRow): Promise<void> {
  const input = job.input as MediaGenInput;
  const provider = input.provider ?? "higgsfield";
  const kind = input.kind ?? "image";

  await updateJobProgress(admin, job.id, 10);

  // === 카드뉴스 (여러 슬라이드) ===
  if (kind === "cardnews") {
    const topic = (input.topic ?? input.prompt ?? "").trim();
    if (!topic && provider !== "figma") throw new Error("카드뉴스 주제가 비어 있습니다.");
    const count = Math.min(Math.max(input.slideCount ?? 5, 1), 10);

    // Figma 템플릿: 지정한 노드를 슬라이드 이미지로 내보내기
    if (provider === "figma") {
      if (!input.figmaFileKey || !input.figmaNodeIds?.length) {
        throw new Error("Figma 카드뉴스는 파일 키와 노드 ID가 필요합니다.");
      }
      const { exportFigmaImages } = await import("@/lib/integrations/figma.server");
      const map = await exportFigmaImages(input.figmaFileKey, input.figmaNodeIds, "png", 2);
      const items = input.figmaNodeIds
        .map((id, i) => ({ url: map[id], prompt: `${topic || "Figma 슬라이드"} #${i + 1}`, meta: { slideIndex: i, nodeId: id } }))
        .filter((it) => it.url);
      if (!items.length) throw new Error("Figma 노드에서 이미지를 가져오지 못했습니다.");
      await insertMediaAssets(admin, job, "figma", "cardnews", items);
      await completeJob(admin, job, { provider: "figma", kind, count: items.length });
      return;
    }

    // Canva: Connect API는 OAuth 2.0(+Autofill은 Enterprise) 필요 → 현재 미지원 안내
    if (provider === "canva") {
      throw new Error(
        "Canva 카드뉴스는 Connect API OAuth 연결(및 Autofill 권한)이 필요해 아직 자동 생성이 지원되지 않습니다. 우선 나노바나나/Higgsfield 또는 Figma 템플릿을 사용하세요."
      );
    }

    // AI 생성 (Gemini 나노바나나 / Higgsfield)
    const slides = await generateSlideTexts(topic, count);
    const created: { url: string; prompt: string; meta: Record<string, unknown> }[] = [];
    for (let i = 0; i < slides.length; i++) {
      const prompt = buildCardNewsPrompt(slides[i], i, slides.length, input.style);
      const url = await generateOneImage(provider, prompt, {
        size: input.size,
        quality: input.quality,
        model: input.model,
      });
      const item = { url, prompt, meta: { slideIndex: i, title: slides[i].title, body: slides[i].body } };
      created.push(item);
      // 슬라이드 단위로 즉시 저장 → 갤러리에 점진적으로 노출
      await insertMediaAssets(admin, job, provider, "cardnews", [item]);
      await updateJobProgress(admin, job.id, 10 + Math.floor(((i + 1) / slides.length) * 85));
    }
    if (!created.length) throw new Error("카드뉴스 슬라이드를 생성하지 못했습니다.");
    await completeJob(admin, job, {
      provider,
      kind,
      count: created.length,
      slides: slides.map((s) => s.title),
    });
    return;
  }

  // === 단일 이미지 / 영상 ===
  await updateJobProgress(admin, job.id, 15);

  if (kind === "video") {
    const { generateHiggsfieldVideo } = await import("@/lib/integrations/higgsfield.server");
    const result = await generateHiggsfieldVideo({
      prompt: input.prompt ?? "",
      imageUrl: input.imageUrl,
      model: input.model,
    });
    await updateJobProgress(admin, job.id, 85);
    if (!result.urls.length) throw new Error("영상 생성 결과가 비어 있습니다 (NSFW 차단 또는 시간 초과).");
    await insertMediaAssets(
      admin,
      job,
      "higgsfield",
      "video",
      result.urls.map((url) => ({ url, prompt: input.prompt, meta: { jobSetId: result.jobSetId } }))
    );
    await completeJob(admin, job, { provider: "higgsfield", kind, urls: result.urls, count: result.urls.length });
    return;
  }

  // 이미지
  const prompt = (input.prompt ?? "").trim();
  if (!prompt) throw new Error("이미지 프롬프트가 비어 있습니다.");

  if (provider === "gemini") {
    const { generateGeminiImage } = await import("@/lib/integrations/gemini.server");
    const r = await generateGeminiImage(prompt, { model: input.model });
    await updateJobProgress(admin, job.id, 85);
    await insertMediaAssets(admin, job, "gemini", "image", [
      { url: r.dataUrl, prompt, meta: { model: r.model } },
    ]);
    await completeJob(admin, job, { provider: "gemini", kind, count: 1, model: r.model });
    return;
  }

  const { generateHiggsfieldImage } = await import("@/lib/integrations/higgsfield.server");
  const result = await generateHiggsfieldImage({
    prompt,
    size: input.size,
    quality: input.quality,
    batchSize: input.batchSize,
  });
  await updateJobProgress(admin, job.id, 85);
  if (!result.urls.length) throw new Error("이미지 생성 결과가 비어 있습니다 (NSFW 차단 또는 시간 초과).");
  await insertMediaAssets(
    admin,
    job,
    "higgsfield",
    "image",
    result.urls.map((url) => ({ url, prompt, meta: { jobSetId: result.jobSetId } }))
  );
  await completeJob(admin, job, { provider: "higgsfield", kind, urls: result.urls, count: result.urls.length });
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
    } else if (job.job_type === "media_gen") {
      await processMediaGenJob(admin, job);
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
