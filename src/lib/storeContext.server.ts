import type { NeonDbClient } from "@/integrations/neon/supabase-compat.server";

export async function isUserAdmin(db: NeonDbClient, userId: string): Promise<boolean> {
  const { data } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}

export async function getUserStoreCode(db: NeonDbClient, userId: string): Promise<string | null> {
  const { data } = await db.from("profiles").select("store_code").eq("id", userId).maybeSingle();
  const row = data as { store_code?: string | null } | null;
  return row?.store_code?.trim() || null;
}

/** 요청 store_code 해석: 본인 매장 또는 admin이면 임의 매장 */
export async function resolveRequestedStoreCode(
  db: NeonDbClient,
  userId: string,
  requested?: string | null,
): Promise<string> {
  const own = await getUserStoreCode(db, userId);
  const req = requested?.trim();
  if (!req || req === own) {
    if (!own) throw new Error("매장 코드를 먼저 등록해주세요.");
    return own;
  }
  if (await isUserAdmin(db, userId)) return req;
  throw new Error("해당 매장에 접근 권한이 없습니다.");
}
