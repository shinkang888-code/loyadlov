import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** OAuth start 라우트용: 본인 매장 또는 admin이 지정한 storeCode */
export async function resolveOAuthStoreCode(
  userId: string,
  requested?: string | null
): Promise<string | null> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("store_code")
    .eq("id", userId)
    .maybeSingle();

  const own = profile?.store_code?.trim() ?? "";
  const req = requested?.trim();

  if (!req || req === own) return own || null;

  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (role) return req;
  return own || null;
}
