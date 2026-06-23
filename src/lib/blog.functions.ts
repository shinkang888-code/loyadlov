// filepath: src/lib/blog.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logActivity } from "@/lib/activity.server";
import { processPendingGenerationJobs } from "@/lib/generation/jobProcessor.server";
import { resolveRequestedStoreCode } from "@/lib/storeContext.server";
import { normalizeCampaignInput } from "@/lib/blog/campaignInput";
import { WRITER_STYLE_NAMES } from "@/lib/blog/draftAi";
import { verifyPostAgainstCampaign } from "@/lib/blog/verificationEngine";
import { buildVerificationReport } from "@/lib/blog/verificationReport";
import { buildRevisionRequest } from "@/lib/blog/revisionRequest";
import { normalizeMobilePostSnapshot } from "@/lib/blog/mobilePostNormalizer";
import { normalizeNaverBlogPostUrl } from "@/lib/blog/naverMobileUrl";

const CampaignFields = {
  subjectValue: z.string().trim().min(1).max(120),
  keywords: z.union([z.string(), z.array(z.string())]).optional(),
  keywordRequiredCount: z.number().int().min(1).max(30).optional(),
  bodyMinCharsNoSpaces: z.number().int().min(0).max(100000).optional(),
  additionalRequests: z.string().max(1000).optional(),
  writer: z.string().max(40).optional(),
  imageMinCount: z.number().int().min(0).max(200).optional(),
  videoRequired: z.boolean().optional(),
  mapRequired: z.boolean().optional(),
};

const EnqueueBlogDraftInput = z.object({
  storeCode: z.string().trim().optional(),
  saveBrief: z.boolean().optional(),
  ...CampaignFields,
});

export type BlogDraftJobResult = {
  jobId: string;
  status: string;
};

async function triggerWorker(): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await processPendingGenerationJobs(supabaseAdmin, 2);
  } catch (e) {
    console.error("[blog-worker] inline trigger failed:", e);
  }
}

export const enqueueBlogDraftFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EnqueueBlogDraftInput.parse(input))
  .handler(async ({ data, context }): Promise<BlogDraftJobResult> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const campaign = normalizeCampaignInput({
      subjectValue: data.subjectValue,
      keywords: data.keywords,
      keywordRequiredCount: data.keywordRequiredCount,
      bodyMinCharsNoSpaces: data.bodyMinCharsNoSpaces,
      additionalRequests: data.additionalRequests,
      imageMinCount: data.imageMinCount,
      videoRequired: data.videoRequired,
      mapRequired: data.mapRequired,
    });
    const writer =
      data.writer && WRITER_STYLE_NAMES.includes(data.writer) ? data.writer : "기본 작가";

    if (data.saveBrief) {
      await supabase.from("campaign_briefs").insert({
        store_code: storeCode,
        created_by: userId,
        subject_value: campaign.subjectValue,
        keywords: campaign.keywords,
        keyword_required_count: campaign.keywordRequiredCount,
        body_min_chars_no_spaces: campaign.bodyMinCharsNoSpaces,
        media_requirements: campaign.mediaRequirements,
        additional_requests: campaign.additionalRequests,
        writer_style: writer,
      });
    }

    const { data: row, error } = await supabase
      .from("generation_jobs")
      .insert({
        store_code: storeCode,
        created_by: userId,
        job_type: "blog_draft",
        priority: 3,
        input: { ...campaign, writer },
      })
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);

    await logActivity(supabase, {
      actorId: userId,
      storeCode,
      action: "blog_draft_enqueued",
      resourceType: "generation_job",
      resourceId: row.id,
      metadata: { writer, subject: campaign.subjectValue.slice(0, 80) },
    });

    void triggerWorker();

    return { jobId: row.id, status: row.status };
  });

const VerifyInput = z.object({
  storeCode: z.string().trim().optional(),
  draftId: z.string().uuid().optional(),
  sourceUrl: z.string().max(2000).optional(),
  postBody: z.string().min(1).max(20000),
  postTitle: z.string().max(200).optional(),
  imageCount: z.number().int().min(0).max(500).optional(),
  videoFound: z.boolean().optional(),
  mapFound: z.boolean().optional(),
  revisionStyle: z.string().max(40).optional(),
  ...CampaignFields,
});

export type VerifyBlogPostResult = {
  verificationId: string | null;
  passed: boolean;
  reportText: string;
  revisionText: string;
  body: { charsNoSpaces: number; required: number; passed: boolean };
  keywords: { keyword: string; count: number; required: number; passed: boolean }[];
};

export const verifyBlogPostFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => VerifyInput.parse(input))
  .handler(async ({ data, context }): Promise<VerifyBlogPostResult> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const campaign = normalizeCampaignInput({
      subjectValue: data.subjectValue,
      keywords: data.keywords,
      keywordRequiredCount: data.keywordRequiredCount,
      bodyMinCharsNoSpaces: data.bodyMinCharsNoSpaces,
      additionalRequests: data.additionalRequests,
      imageMinCount: data.imageMinCount,
      videoRequired: data.videoRequired,
      mapRequired: data.mapRequired,
    });

    let sourceUrl = data.sourceUrl ?? "";
    if (sourceUrl) {
      const normalized = normalizeNaverBlogPostUrl(sourceUrl);
      if (normalized.ok) sourceUrl = normalized.mobileUrl;
    }

    const post = normalizeMobilePostSnapshot({
      title: data.postTitle,
      bodyText: data.postBody,
      sourceUrl,
      imageCount: data.imageCount,
      videoFound: data.videoFound,
      mapFound: data.mapFound,
    });

    const verification = verifyPostAgainstCampaign(campaign, post, []);
    const reportText = buildVerificationReport({ campaign, verification, normalizedPost: post });
    const revision = buildRevisionRequest({
      campaign,
      verification,
      normalizedPost: post,
      revisionStyle: data.revisionStyle,
    });

    const { data: row, error } = await supabase
      .from("campaign_verifications")
      .insert({
        store_code: storeCode,
        created_by: userId,
        draft_id: data.draftId ?? null,
        source_url: sourceUrl || null,
        passed: verification.passed,
        body: verification.body,
        keywords: verification.keywords,
        media: verification.media,
        request_results: verification.requestResults,
        report_text: reportText,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logActivity(supabase, {
      actorId: userId,
      storeCode,
      action: "blog_post_verified",
      resourceType: "campaign_verification",
      resourceId: row.id,
      metadata: { passed: verification.passed },
    });

    return {
      verificationId: row.id,
      passed: verification.passed,
      reportText,
      revisionText: revision.text,
      body: verification.body,
      keywords: verification.keywords.map((k) => ({
        keyword: k.keyword,
        count: k.count,
        required: k.required,
        passed: k.passed,
      })),
    };
  });
