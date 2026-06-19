import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

export async function logActivity(
  supabase: SB,
  params: {
    actorId: string;
    storeCode: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabase.from("activity_audit").insert({
      actor_id: params.actorId,
      store_code: params.storeCode,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId ?? null,
      metadata: (params.metadata ?? {}) as Json,
    });
  } catch {
    // 감사 로그 실패는 본 작업을 막지 않음
  }
}
