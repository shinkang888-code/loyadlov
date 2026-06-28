import type { NeonDbClient } from "@/integrations/neon/supabase-compat.server";
import { isUserAdmin } from "@/lib/storeContext.server";

export async function isUserOwner(db: NeonDbClient, userId: string): Promise<boolean> {
  const { data } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  return Boolean(data);
}

/** 플랫폼 API 키·OAuth 자격증명을 저장할 수 있는 역할 */
export async function canManagePlatformSettings(db: NeonDbClient, userId: string): Promise<boolean> {
  if (await isUserAdmin(db, userId)) return true;
  return isUserOwner(db, userId);
}
