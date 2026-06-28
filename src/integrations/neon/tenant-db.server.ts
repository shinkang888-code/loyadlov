// filepath: src/integrations/neon/tenant-db.server.ts
/**
 * Neon serverless는 요청마다 DB 세션이 분리될 수 있어 RLS session var 대신
 * compat 쿼리에 store_code 필터를 주입하는 테넌트 가드 레이어.
 */
import { createNeonDb, type NeonDbClient } from "./supabase-compat.server";

const TENANT_TABLES = new Set([
  "content_drafts",
  "publish_schedule",
  "generation_jobs",
  "social_posts",
  "social_accounts",
  "activity_audit",
  "campaign_briefs",
  "campaign_verifications",
  "media_assets",
  "kakao_consultations",
  "kakao_messages",
  "members",
  "threadbot_rules",
  "threadbot_activity_logs",
  "subscriptions",
  "kakao_channel_settings",
  "platform_secrets",
]);

export type TenantScope = {
  userId: string;
  storeCode: string;
  isAdmin: boolean;
};

export function createTenantDb(scope: TenantScope): NeonDbClient {
  const base = createNeonDb();
  return {
    from<T>(table: string) {
      const q = base.from<T>(table);
      if (!TENANT_TABLES.has(table) || scope.isAdmin) return q;
      return q.eq("store_code", scope.storeCode) as typeof q;
    },
    rpc<T>(fn: string, args?: Record<string, unknown>) {
      return base.rpc<T>(fn, args);
    },
  };
}

export async function resolveTenantScope(
  db: NeonDbClient,
  userId: string,
  requestedStoreCode?: string | null,
): Promise<TenantScope> {
  const { data: roleRow } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  const isAdmin = Boolean(roleRow);

  const { data: profile } = await db
    .from("profiles")
    .select("store_code")
    .eq("id", userId)
    .maybeSingle();
  const own = (profile as { store_code?: string | null } | null)?.store_code?.trim() || "";
  const req = requestedStoreCode?.trim();

  if (req && req !== own) {
    if (!isAdmin) throw new Error("해당 매장에 접근 권한이 없습니다.");
    return { userId, storeCode: req, isAdmin: true };
  }
  if (!own) throw new Error("매장 코드를 먼저 등록해주세요.");
  return { userId, storeCode: own, isAdmin };
}
