import type { Json } from "@/integrations/supabase/types";

export type SocialPlatform = "instagram" | "threads" | "youtube" | "naver_blog";

export type SocialPostStatus = "draft" | "scheduled" | "published" | "failed";

export type NaverBlogPostOptions = {
  categoryNo?: number;
  openType?: "all" | "closed" | "neighbor" | "agreedNeighbor";
};

export type SocialPostPlatformOptions = NaverBlogPostOptions | Record<string, unknown>;

export interface SocialAccountRow {
  id: string;
  store_code: string;
  platform: SocialPlatform;
  platform_user_id: string;
  display_name: string;
  access_token_enc: string;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  metadata: Json;
  connected_by: string;
  created_at: string;
  updated_at: string;
}

export interface SocialAccountPublic {
  id: string;
  platform: SocialPlatform;
  platformUserId: string;
  displayName: string;
  tokenExpiresAt: string | null;
  metadata: Json;
  connectedBy: string;
  connectedAt: string;
}

export interface SocialPostRow {
  id: string;
  store_code: string;
  account_id: string | null;
  platform: SocialPlatform;
  status: SocialPostStatus;
  caption: string;
  media_urls: string[];
  platform_options?: SocialPostPlatformOptions;
  scheduled_at: string | null;
  published_at: string | null;
  platform_post_id: string | null;
  error_message: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SocialPostPublic {
  id: string;
  platform: SocialPlatform;
  status: SocialPostStatus;
  caption: string;
  mediaUrls: string[];
  platformOptions: SocialPostPlatformOptions;
  scheduledAt: string | null;
  publishedAt: string | null;
  platformPostId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  threads: "Threads",
  youtube: "YouTube",
  naver_blog: "네이버 블로그",
};

export const SOCIAL_PLATFORM_ICONS: Record<SocialPlatform, string> = {
  instagram: "📸",
  threads: "🧵",
  youtube: "▶️",
  naver_blog: "📝",
};

export const ALL_SOCIAL_PLATFORMS: SocialPlatform[] = [
  "instagram",
  "threads",
  "youtube",
  "naver_blog",
];
