import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createSocialPost,
  deleteSocialAccount,
  isKakaoOAuthConfigured,
  isMetaOAuthConfigured,
  isNaverOAuthConfigured,
  isTikTokOAuthConfigured,
  listSocialAccounts,
  listSocialPosts,
  resetSocialPostForRetry,
} from "@/lib/social/socialAccountServer";
import { isGoogleOAuthConfiguredAsync } from "@/lib/googleOAuth.server";
import { generateSocialCaption } from "@/lib/social/socialAiDraft";
import { publishSocialPostById } from "@/lib/social/socialPublishService";
import { getNaverBlogCategoriesForStore } from "@/lib/social/naverCategories.server";
import {
  getMetaOAuthCredentials,
  saveMetaOAuthSettings,
  type MetaOAuthSettings,
} from "@/lib/social/metaOAuthSettings";
import {
  getNaverOAuthCredentials,
  saveNaverOAuthSettings,
  type NaverOAuthSettings,
} from "@/lib/social/naverOAuthSettings";
import {
  getYouTubeOAuthCredentials,
  saveYouTubeOAuthSettings,
  type YouTubeOAuthSettings,
} from "@/lib/social/youtubeOAuthSettings";
import {
  getTikTokOAuthCredentials,
  saveTikTokOAuthSettings,
  type TikTokOAuthSettings,
} from "@/lib/social/tiktokOAuthSettings";
import {
  getKakaoOAuthCredentials,
  saveKakaoOAuthSettings,
  type KakaoOAuthSettings,
} from "@/lib/social/kakaoOAuthSettings";
import { resolveRequestedStoreCode } from "@/lib/storeContext.server";
import type { SocialPlatform } from "@/lib/social/types";
import { logActivity } from "@/lib/activity.server";

const Platform = z.enum(["instagram", "threads", "youtube", "naver_blog", "tiktok", "kakao"]);
const StoreCodeInput = z.object({ storeCode: z.string().trim().optional() });

async function resolveStore(
  supabase: Parameters<typeof resolveRequestedStoreCode>[0],
  userId: string,
  requested?: string | null
): Promise<string> {
  return resolveRequestedStoreCode(supabase, userId, requested);
}

export const listSocialAccountsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreCodeInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const storeCode = await resolveStore(context.supabase, context.userId, data.storeCode);
    const accounts = await listSocialAccounts(storeCode);
    const [meta, youtube, naver, tiktok, kakao] = await Promise.all([
      isMetaOAuthConfigured(),
      isGoogleOAuthConfiguredAsync(),
      isNaverOAuthConfigured(),
      isTikTokOAuthConfigured(),
      isKakaoOAuthConfigured(),
    ]);
    return { accounts, config: { meta, youtube, naver, tiktok, kakao } };
  });

export const listSocialPostsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreCodeInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const storeCode = await resolveStore(context.supabase, context.userId, data.storeCode);
    const posts = await listSocialPosts(storeCode);
    return { posts };
  });

const CreatePostInput = StoreCodeInput.extend({
  platform: Platform,
  caption: z.string().trim().min(1).max(8000),
  mediaUrls: z.array(z.string().url()).max(5).optional().default([]),
  scheduledAt: z.string().datetime().optional().nullable(),
  platformOptions: z.record(z.unknown()).optional().default({}),
});

export const createSocialPostFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreatePostInput.parse(input))
  .handler(async ({ data, context }) => {
    const storeCode = await resolveStore(context.supabase, context.userId, data.storeCode);
    const accounts = await listSocialAccounts(storeCode);
    const account = accounts.find((a) => a.platform === data.platform);
    const status = data.scheduledAt ? "scheduled" : "draft";
    const post = await createSocialPost({
      storeCode,
      accountId: account?.id ?? null,
      platform: data.platform,
      caption: data.caption,
      mediaUrls: data.mediaUrls,
      platformOptions: data.platformOptions,
      status,
      scheduledAt: data.scheduledAt ?? null,
      createdBy: context.claims?.email?.toString() ?? context.userId,
    });
    if (!post) throw new Error("포스트 저장 실패");
    return { post };
  });

export const publishSocialPostFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ postId: z.string().uuid(), storeCode: z.string().trim().optional() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const storeCode = await resolveStore(context.supabase, context.userId, data.storeCode);
    const origin = process.env.APP_URL?.trim() || "https://localhost";
    const result = await publishSocialPostById(data.postId, origin);
    if (!result.ok) throw new Error(result.error);

    await logActivity(context.supabase, {
      actorId: context.userId,
      storeCode,
      action: "post_published",
      resourceType: "social_post",
      resourceId: data.postId,
    });

    return result;
  });

export const retrySocialPostFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ postId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await resolveStore(context.supabase, context.userId, null);
    const post = await resetSocialPostForRetry(data.postId);
    if (!post) throw new Error("재시도 준비 실패");
    const origin = process.env.APP_URL?.trim() || "https://localhost";
    const result = await publishSocialPostById(data.postId, origin);
    if (!result.ok) throw new Error(result.error);
    return result;
  });

export const disconnectSocialAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ accountId: z.string().uuid(), storeCode: z.string().trim().optional() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const storeCode = await resolveStore(context.supabase, context.userId, data.storeCode);
    const ok = await deleteSocialAccount(storeCode, data.accountId);
    if (!ok) throw new Error("연결 해제 실패");
    return { ok: true };
  });

const AiDraftInput = StoreCodeInput.extend({
  topic: z.string().trim().min(1).max(200),
  platform: Platform,
  tone: z.string().max(80).optional(),
  keywords: z.array(z.string()).optional(),
  storeName: z.string().optional(),
  industry: z.string().optional(),
});

export const generateSocialAiDraftFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AiDraftInput.parse(input))
  .handler(async ({ data }) => {
    const result = await generateSocialCaption(data);
    if (!result.ok) throw new Error(result.error ?? "AI 생성 실패");
    return result;
  });

export const listNaverCategoriesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreCodeInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const storeCode = await resolveStore(context.supabase, context.userId, data.storeCode);
    const categories = await getNaverBlogCategoriesForStore(storeCode);
    return { categories };
  });

export const getOAuthSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const [meta, naver, youtube, tiktok, kakao] = await Promise.all([
      getMetaOAuthCredentials(),
      getNaverOAuthCredentials(),
      getYouTubeOAuthCredentials(),
      getTikTokOAuthCredentials(),
      getKakaoOAuthCredentials(),
    ]);
    return {
      meta: { configured: Boolean(meta.appId && meta.appSecret), source: meta.source },
      naver: { configured: Boolean(naver.clientId && naver.clientSecret), source: naver.source },
      youtube: {
        configured: Boolean(youtube.clientId && youtube.clientSecret),
        source: youtube.source,
      },
      tiktok: {
        configured: Boolean(tiktok.clientKey && tiktok.clientSecret),
        source: tiktok.source,
      },
      kakao: {
        configured: Boolean(kakao.restApiKey && kakao.clientSecret),
        source: kakao.source,
      },
    };
  });

export const saveMetaOAuthSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ settings: z.custom<MetaOAuthSettings>() }).parse(input))
  .handler(async ({ data }) => {
    const ok = await saveMetaOAuthSettings(data.settings);
    if (!ok) throw new Error("Meta OAuth 설정 저장 실패");
    return { ok: true };
  });

export const saveNaverOAuthSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ settings: z.custom<NaverOAuthSettings>() }).parse(input))
  .handler(async ({ data }) => {
    const ok = await saveNaverOAuthSettings(data.settings);
    if (!ok) throw new Error("Naver OAuth 설정 저장 실패");
    return { ok: true };
  });

export const saveYouTubeOAuthSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ settings: z.custom<YouTubeOAuthSettings>() }).parse(input))
  .handler(async ({ data }) => {
    const ok = await saveYouTubeOAuthSettings(data.settings);
    if (!ok) throw new Error("YouTube OAuth 설정 저장 실패");
    return { ok: true };
  });

export const saveTikTokOAuthSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ settings: z.custom<TikTokOAuthSettings>() }).parse(input))
  .handler(async ({ data }) => {
    const ok = await saveTikTokOAuthSettings(data.settings);
    if (!ok) throw new Error("TikTok OAuth 설정 저장 실패");
    return { ok: true };
  });

export const saveKakaoOAuthSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ settings: z.custom<KakaoOAuthSettings>() }).parse(input))
  .handler(async ({ data }) => {
    const ok = await saveKakaoOAuthSettings(data.settings);
    if (!ok) throw new Error("Kakao OAuth 설정 저장 실패");
    return { ok: true };
  });

export type { SocialPlatform };
