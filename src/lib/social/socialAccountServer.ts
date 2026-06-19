import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { encryptToken, decryptToken } from "@/lib/social/tokenCrypto";
import { isMetaOAuthEnabled } from "@/lib/social/metaOAuthSettings";
import { isYouTubeOAuthEnabled } from "@/lib/social/youtubeOAuthSettings";
import { isNaverOAuthEnabled } from "@/lib/social/naverOAuthSettings";
import { isTikTokOAuthEnabled } from "@/lib/social/tiktokOAuthSettings";
import { isKakaoOAuthEnabled } from "@/lib/social/kakaoOAuthSettings";
import type {
  SocialAccountPublic,
  SocialAccountRow,
  SocialPlatform,
  SocialPostPlatformOptions,
  SocialPostPublic,
  SocialPostRow,
  SocialPostStatus,
} from "@/lib/social/types";

export type SocialAccountWithTokens = {
  id: string;
  platform: SocialPlatform;
  platform_user_id: string;
  display_name: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  metadata: Record<string, unknown>;
  access_token_enc: string;
  refresh_token_enc: string | null;
};

function toAccountPublic(row: SocialAccountRow): SocialAccountPublic {
  return {
    id: row.id,
    platform: row.platform,
    platformUserId: row.platform_user_id,
    displayName: row.display_name,
    tokenExpiresAt: row.token_expires_at,
    metadata: row.metadata ?? {},
    connectedBy: row.connected_by,
    connectedAt: row.created_at,
  };
}

function toPostPublic(row: SocialPostRow): SocialPostPublic {
  return {
    id: row.id,
    platform: row.platform,
    status: row.status,
    caption: row.caption,
    mediaUrls: Array.isArray(row.media_urls) ? row.media_urls : [],
    platformOptions: (row.platform_options ?? {}) as SocialPostPlatformOptions,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    platformPostId: row.platform_post_id,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

export async function listSocialAccounts(storeCode: string): Promise<SocialAccountPublic[]> {
  const { data, error } = await supabaseAdmin
    .from("social_accounts")
    .select("*")
    .eq("store_code", storeCode)
    .order("platform");
  if (error || !data) return [];
  return (data as SocialAccountRow[]).map(toAccountPublic);
}

export async function upsertSocialAccount(input: {
  storeCode: string;
  platform: SocialPlatform;
  platformUserId: string;
  displayName: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  metadata?: Record<string, unknown>;
  connectedBy: string;
}): Promise<SocialAccountPublic | null> {
  const row = {
    store_code: input.storeCode,
    platform: input.platform,
    platform_user_id: input.platformUserId,
    display_name: input.displayName,
    access_token_enc: encryptToken(input.accessToken),
    refresh_token_enc: input.refreshToken ? encryptToken(input.refreshToken) : null,
    token_expires_at: input.tokenExpiresAt ?? null,
    metadata: (input.metadata ?? {}) as Json,
    connected_by: input.connectedBy,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("social_accounts")
    .upsert(row, { onConflict: "store_code,platform,platform_user_id" })
    .select("*")
    .single();

  if (error || !data) return null;
  return toAccountPublic(data as SocialAccountRow);
}

export async function getSocialAccountForPublish(
  accountId: string
): Promise<SocialAccountWithTokens | null> {
  const { data } = await supabaseAdmin.from("social_accounts").select("*").eq("id", accountId).maybeSingle();
  if (!data) return null;
  const row = data as SocialAccountRow;
  const accessToken = decryptToken(row.access_token_enc);
  if (!accessToken) return null;
  return {
    id: row.id,
    platform: row.platform,
    platform_user_id: row.platform_user_id,
    display_name: row.display_name,
    accessToken,
    refreshToken: row.refresh_token_enc ? decryptToken(row.refresh_token_enc) : null,
    tokenExpiresAt: row.token_expires_at,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    access_token_enc: row.access_token_enc,
    refresh_token_enc: row.refresh_token_enc,
  };
}

export async function updateSocialAccountTokens(
  accountId: string,
  input: {
    accessToken: string;
    refreshToken?: string | null;
    tokenExpiresAt?: string | null;
  }
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("social_accounts")
    .update({
      access_token_enc: encryptToken(input.accessToken),
      refresh_token_enc: input.refreshToken ? encryptToken(input.refreshToken) : undefined,
      token_expires_at: input.tokenExpiresAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);
  return !error;
}

export async function listAccountsNeedingTokenRefresh(): Promise<SocialAccountRow[]> {
  const threshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("social_accounts")
    .select("*")
    .or(`token_expires_at.is.null,token_expires_at.lt."${threshold}"`);
  return (data ?? []) as SocialAccountRow[];
}

export async function deleteSocialAccount(storeCode: string, accountId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("social_accounts")
    .delete()
    .eq("id", accountId)
    .eq("store_code", storeCode);
  return !error;
}

export async function listSocialPosts(storeCode: string, limit = 30): Promise<SocialPostPublic[]> {
  const { data, error } = await supabaseAdmin
    .from("social_posts")
    .select("*")
    .eq("store_code", storeCode)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as SocialPostRow[]).map(toPostPublic);
}

export async function getSocialPostById(postId: string): Promise<SocialPostRow | null> {
  const { data } = await supabaseAdmin.from("social_posts").select("*").eq("id", postId).maybeSingle();
  return (data as SocialPostRow) ?? null;
}

export async function listDueScheduledPosts(): Promise<SocialPostRow[]> {
  const now = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from("social_posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(50);
  return (data ?? []) as SocialPostRow[];
}

export async function createSocialPost(input: {
  storeCode: string;
  accountId?: string | null;
  platform: SocialPlatform;
  caption: string;
  mediaUrls?: string[];
  platformOptions?: SocialPostPlatformOptions;
  status?: SocialPostStatus;
  scheduledAt?: string | null;
  createdBy: string;
}): Promise<SocialPostRow | null> {
  const { data, error } = await supabaseAdmin
    .from("social_posts")
    .insert({
      store_code: input.storeCode,
      account_id: input.accountId ?? null,
      platform: input.platform,
      status: input.status ?? "draft",
      caption: input.caption,
      media_urls: input.mediaUrls ?? [],
      platform_options: (input.platformOptions ?? {}) as Json,
      scheduled_at: input.scheduledAt ?? null,
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (error || !data) return null;
  return data as SocialPostRow;
}

export async function markSocialPostPublished(postId: string, platformPostId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("social_posts")
    .update({
      status: "published",
      platform_post_id: platformPostId,
      published_at: new Date().toISOString(),
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
  return !error;
}

export async function markSocialPostFailed(postId: string, errorMessage: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("social_posts")
    .update({
      status: "failed",
      error_message: errorMessage.slice(0, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
  return !error;
}

export async function resetSocialPostForRetry(postId: string): Promise<SocialPostRow | null> {
  const { data, error } = await supabaseAdmin
    .from("social_posts")
    .update({
      status: "draft",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .select("*")
    .single();
  if (error || !data) return null;
  return data as SocialPostRow;
}

export async function resolveStoreCodeForUser(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("store_code")
    .eq("id", userId)
    .maybeSingle();
  return data?.store_code?.trim() || null;
}

export async function isMetaOAuthConfigured(): Promise<boolean> {
  return isMetaOAuthEnabled();
}

export async function isYouTubeOAuthConfigured(): Promise<boolean> {
  return isYouTubeOAuthEnabled();
}

export async function isNaverOAuthConfigured(): Promise<boolean> {
  return isNaverOAuthEnabled();
}

export async function isTikTokOAuthConfigured(): Promise<boolean> {
  return isTikTokOAuthEnabled();
}

export async function isKakaoOAuthConfigured(): Promise<boolean> {
  return isKakaoOAuthEnabled();
}

export { toPostPublic };
