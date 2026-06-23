import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isUserAdmin } from "@/lib/storeContext.server";

type SB = SupabaseClient<Database>;

export async function isUserOwner(supabase: SB, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  return Boolean(data);
}

/** 플랫폼 API 키·OAuth 자격증명을 저장할 수 있는 역할 */
export async function canManagePlatformSettings(supabase: SB, userId: string): Promise<boolean> {
  if (await isUserAdmin(supabase, userId)) return true;
  return isUserOwner(supabase, userId);
}
