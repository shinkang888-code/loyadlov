import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logActivity } from "@/lib/activity.server";
import { isUserAdmin, resolveRequestedStoreCode } from "@/lib/storeContext.server";

export type StoreSummary = {
  storeCode: string;
  businessName: string;
  industry: string;
  displayName: string | null;
  instagramHandle: string | null;
  naverHandle: string | null;
  onboardedAt: string | null;
  memberCount: number;
  publishedThisMonth: number;
  queuedCount: number;
  connectedPlatforms: string[];
  status: "active" | "pending" | "needs-auth";
  plan: string;
};

export type MemberRow = {
  id: string;
  email: string | null;
  displayName: string | null;
  storeCode: string | null;
  businessName: string | null;
  industry: string | null;
  onboardedAt: string | null;
  roles: string[];
  createdAt: string;
};

export type QueueItem = {
  id: string;
  kind: "schedule" | "social" | "draft";
  title: string;
  channel: string;
  status: string;
  scheduledAt: string | null;
  storeCode: string;
  createdAt: string;
};

export type ActivityItem = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, string | number | boolean | null>;
  storeCode: string | null;
  createdAt: string;
};

export type AnalyticsSummary = {
  totalPublished: number;
  totalFailed: number;
  totalScheduled: number;
  publishedThisMonth: number;
  byPlatform: Record<string, number>;
  successRate: number;
  recentPosts: Array<{
    id: string;
    platform: string;
    status: string;
    caption: string;
    publishedAt: string | null;
    createdAt: string;
  }>;
};

const StoreCodeInput = z.object({ storeCode: z.string().trim().optional() });

function derivePlan(publishedThisMonth: number): string {
  if (publishedThisMonth >= 20) return "Premium";
  if (publishedThisMonth >= 10) return "Standard";
  return "Standard";
}

function deriveStatus(
  onboardedAt: string | null,
  expiringAccounts: number
): StoreSummary["status"] {
  if (!onboardedAt) return "pending";
  if (expiringAccounts > 0) return "needs-auth";
  return "active";
}

export const getCurrentUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    const admin = await isUserAdmin(supabase, userId);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    return {
      profile,
      isAdmin: admin,
      roles: (roles ?? []).map((r) => r.role),
      email: claims?.email?.toString() ?? profile?.email ?? "",
    };
  });

export const listStoresFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ stores: StoreSummary[]; isAdmin: boolean }> => {
    const { supabase, userId } = context;
    const admin = await isUserAdmin(supabase, userId);
    const { data: ownProfile } = await supabase
      .from("profiles")
      .select("store_code")
      .eq("id", userId)
      .maybeSingle();
    const ownStore = ownProfile?.store_code?.trim();

    let profileQuery = supabase
      .from("profiles")
      .select(
        "store_code, business_name, industry, display_name, instagram_handle, naver_handle, onboarded_at"
      )
      .not("store_code", "is", null);

    if (!admin && ownStore) {
      profileQuery = profileQuery.eq("store_code", ownStore);
    }

    const { data: profiles, error } = await profileQuery;
    if (error) throw new Error(error.message);

    const byStore = new Map<string, (typeof profiles)[0]>();
    for (const p of profiles ?? []) {
      const code = p.store_code?.trim();
      if (!code) continue;
      if (!byStore.has(code)) byStore.set(code, p);
    }

    const storeCodes = [...byStore.keys()];
    if (storeCodes.length === 0) {
      return { stores: [], isAdmin: admin };
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [postsRes, scheduleRes, accountsRes, memberCounts] = await Promise.all([
      supabase
        .from("social_posts")
        .select("store_code, status, created_at, platform")
        .in("store_code", storeCodes),
      supabase
        .from("publish_schedule")
        .select("store_code, status")
        .in("store_code", storeCodes)
        .in("status", ["queued", "publishing"]),
      supabase
        .from("social_accounts")
        .select("store_code, platform, token_expires_at")
        .in("store_code", storeCodes),
      supabase.from("profiles").select("store_code").in("store_code", storeCodes),
    ]);

    const posts = postsRes.data ?? [];
    const schedules = scheduleRes.data ?? [];
    const accounts = accountsRes.data ?? [];
    const members = memberCounts.data ?? [];

    const soon = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const stores: StoreSummary[] = storeCodes.map((code) => {
      const p = byStore.get(code)!;
      const storePosts = posts.filter((x) => x.store_code === code);
      const publishedThisMonth = storePosts.filter(
        (x) => x.status === "published" && new Date(x.created_at) >= monthStart
      ).length;
      const queuedCount =
        schedules.filter((x) => x.store_code === code).length +
        storePosts.filter((x) => x.status === "scheduled").length;
      const connectedPlatforms = [...new Set(accounts.filter((a) => a.store_code === code).map((a) => a.platform))];
      const expiring = accounts.filter(
        (a) =>
          a.store_code === code &&
          a.token_expires_at &&
          new Date(a.token_expires_at).getTime() < soon
      ).length;

      return {
        storeCode: code,
        businessName: p.business_name?.trim() || p.display_name?.trim() || code,
        industry: p.industry?.trim() || "미분류",
        displayName: p.display_name,
        instagramHandle: p.instagram_handle,
        naverHandle: p.naver_handle,
        onboardedAt: p.onboarded_at,
        memberCount: members.filter((m) => m.store_code === code).length,
        publishedThisMonth,
        queuedCount,
        connectedPlatforms,
        status: deriveStatus(p.onboarded_at, expiring),
        plan: derivePlan(publishedThisMonth),
      };
    });

    stores.sort((a, b) => a.businessName.localeCompare(b.businessName, "ko"));
    return { stores, isAdmin: admin };
  });

export const listMembersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreCodeInput.parse(input))
  .handler(async ({ data, context }): Promise<{ members: MemberRow[] }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, email, display_name, store_code, business_name, industry, onboarded_at, created_at")
      .eq("store_code", storeCode)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.id);
    const { data: roles } =
      ids.length > 0
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids)
        : { data: [] };

    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const list = roleMap.get(r.user_id) ?? [];
      list.push(r.role);
      roleMap.set(r.user_id, list);
    }

    return {
      members: (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        displayName: p.display_name,
        storeCode: p.store_code,
        businessName: p.business_name,
        industry: p.industry,
        onboardedAt: p.onboarded_at,
        roles: roleMap.get(p.id) ?? ["owner"],
        createdAt: p.created_at,
      })),
    };
  });

export const listQueueFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreCodeInput.parse(input))
  .handler(async ({ data, context }): Promise<{ items: QueueItem[]; total: number }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const [schedRes, socialRes, draftRes] = await Promise.all([
      supabase
        .from("publish_schedule")
        .select("id, channel, status, scheduled_at, store_code, created_at, draft_id")
        .eq("store_code", storeCode)
        .in("status", ["queued", "publishing", "failed"])
        .order("scheduled_at", { ascending: true })
        .limit(30),
      supabase
        .from("social_posts")
        .select("id, platform, status, scheduled_at, store_code, created_at, caption")
        .eq("store_code", storeCode)
        .in("status", ["scheduled", "draft", "failed"])
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("content_drafts")
        .select("id, title, channel, status, store_code, created_at")
        .eq("store_code", storeCode)
        .in("status", ["draft", "review", "approved"])
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const items: QueueItem[] = [
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
      ...(socialRes.data ?? []).map((r) => ({
        id: r.id,
        kind: "social" as const,
        title: r.caption.slice(0, 40) + (r.caption.length > 40 ? "…" : ""),
        channel: r.platform,
        status: r.status,
        scheduledAt: r.scheduled_at,
        storeCode: r.store_code,
        createdAt: r.created_at,
      })),
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
    ];

    items.sort((a, b) => {
      const ta = a.scheduledAt ?? a.createdAt;
      const tb = b.scheduledAt ?? b.createdAt;
      return new Date(ta).getTime() - new Date(tb).getTime();
    });

    return { items, total: items.length };
  });

export const listActivityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    StoreCodeInput.extend({ limit: z.number().int().min(1).max(50).optional() }).parse(input)
  )
  .handler(async ({ data, context }): Promise<{ activities: ActivityItem[] }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const { data: rows, error } = await supabase
      .from("activity_audit")
      .select("*")
      .eq("store_code", storeCode)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 15);
    if (error) throw new Error(error.message);

    return {
      activities: (rows ?? []).map((r) => ({
        id: r.id,
        action: r.action,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        metadata: (r.metadata ?? {}) as Record<string, string | number | boolean | null>,
        storeCode: r.store_code,
        createdAt: r.created_at,
      })),
    };
  });

export const getAnalyticsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreCodeInput.parse(input))
  .handler(async ({ data, context }): Promise<AnalyticsSummary> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: posts, error } = await supabase
      .from("social_posts")
      .select("id, platform, status, caption, published_at, created_at")
      .eq("store_code", storeCode)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const all = posts ?? [];
    const published = all.filter((p) => p.status === "published");
    const failed = all.filter((p) => p.status === "failed");
    const scheduled = all.filter((p) => p.status === "scheduled");
    const publishedThisMonth = published.filter((p) => new Date(p.created_at) >= monthStart).length;

    const byPlatform: Record<string, number> = {};
    for (const p of published) {
      byPlatform[p.platform] = (byPlatform[p.platform] ?? 0) + 1;
    }

    const attempts = published.length + failed.length;
    const successRate = attempts > 0 ? Math.round((published.length / attempts) * 100) : 100;

    return {
      totalPublished: published.length,
      totalFailed: failed.length,
      totalScheduled: scheduled.length,
      publishedThisMonth,
      byPlatform,
      successRate,
      recentPosts: all.slice(0, 10).map((p) => ({
        id: p.id,
        platform: p.platform,
        status: p.status,
        caption: p.caption.slice(0, 80),
        publishedAt: p.published_at,
        createdAt: p.created_at,
      })),
    };
  });

export const assignMemberRoleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["owner", "staff", "admin"]),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId: actorId } = context;
    if (!(await isUserAdmin(supabase, actorId))) {
      throw new Error("관리자 권한이 필요합니다.");
    }

    const { error } = await supabase.from("user_roles").upsert(
      { user_id: data.userId, role: data.role },
      { onConflict: "user_id,role" }
    );
    if (error) throw new Error(error.message);

    const storeCode = await resolveRequestedStoreCode(supabase, actorId, null);
    await logActivity(supabase, {
      actorId,
      storeCode,
      action: "role_assigned",
      resourceType: "user",
      resourceId: data.userId,
      metadata: { role: data.role },
    });

    return { ok: true };
  });
