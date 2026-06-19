/**
 * 소셜 포스트 발행 오케스트레이터
 */

import { publishToInstagram } from "@/lib/social/instagramPublisher";
import { publishToThreads } from "@/lib/social/threadsPublisher";
import { publishToYouTube } from "@/lib/social/youtubePublisher";
import { publishNaverBlogFromCaption } from "@/lib/social/naverBlogPublisher";
import {
  getSocialAccountForPublish,
  markSocialPostFailed,
  markSocialPostPublished,
} from "@/lib/social/socialAccountServer";
import { decryptToken } from "@/lib/social/tokenCrypto";
import type { NaverBlogPostOptions, SocialPostRow } from "@/lib/social/types";

export type PublishOutcome =
  | { ok: true; platformPostId: string }
  | { ok: false; error: string };

export async function publishSocialPost(
  post: SocialPostRow,
  origin: string
): Promise<PublishOutcome> {
  if (!post.account_id) {
    return { ok: false, error: "연결된 소셜 계정이 없습니다." };
  }

  const account = await getSocialAccountForPublish(post.account_id);
  if (!account) {
    return { ok: false, error: "소셜 계정을 찾을 수 없거나 토큰이 만료되었습니다." };
  }

  const mediaUrls = Array.isArray(post.media_urls) ? post.media_urls : [];
  const mediaUrl = mediaUrls[0] ?? null;
  const meta = account.metadata ?? {};

  let result: PublishOutcome;

  switch (post.platform) {
    case "threads": {
      const threadsUserId = String(meta.threadsUserId ?? account.platform_user_id);
      result = await publishToThreads({
        accessToken: account.accessToken,
        threadsUserId,
        caption: post.caption,
        mediaUrl,
      });
      break;
    }
    case "instagram": {
      const igId = String(meta.instagramBusinessAccountId ?? "");
      let pageToken = String(meta.pageAccessToken ?? "");
      if (!pageToken && meta.pageAccessTokenEnc) {
        pageToken = decryptToken(String(meta.pageAccessTokenEnc)) ?? "";
      }
      if (!pageToken) pageToken = account.accessToken;
      if (!igId) {
        result = {
          ok: false,
          error: "Instagram Business 계정이 연결되지 않았습니다. Facebook Page + IG Business 연결 후 재인증하세요.",
        };
        break;
      }
      result = await publishToInstagram({
        pageAccessToken: pageToken,
        instagramBusinessAccountId: igId,
        caption: post.caption,
        mediaUrl,
      });
      break;
    }
    case "youtube": {
      const titleLine = post.caption.split("\n")[0]?.trim() || "Loyad Video";
      result = await publishToYouTube({
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        origin,
        title: titleLine,
        description: post.caption,
        mediaUrl,
        scheduledAt: post.scheduled_at,
      });
      break;
    }
    case "naver_blog": {
      const naverOpts = (post.platform_options ?? {}) as NaverBlogPostOptions;
      result = await publishNaverBlogFromCaption(
        account.accessToken,
        post.caption,
        mediaUrl,
        naverOpts
      );
      break;
    }
    default:
      result = { ok: false, error: `지원하지 않는 플랫폼: ${post.platform}` };
  }

  if (result.ok) {
    await markSocialPostPublished(post.id, result.platformPostId);
  } else {
    await markSocialPostFailed(post.id, result.error);
  }

  return result;
}

export async function publishSocialPostById(
  postId: string,
  origin: string
): Promise<PublishOutcome & { postId: string }> {
  const { getSocialPostById } = await import("@/lib/social/socialAccountServer");
  const post = await getSocialPostById(postId);
  if (!post) {
    return { ok: false, error: "포스트를 찾을 수 없습니다.", postId };
  }
  if (post.status === "published") {
    return { ok: false, error: "이미 발행된 포스트입니다.", postId };
  }

  const outcome = await publishSocialPost(post, origin);
  return { ...outcome, postId };
}
