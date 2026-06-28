import { createAuthClient } from "@neondatabase/auth";
import { SupabaseAuthAdapter } from "@neondatabase/auth/vanilla/adapters";
import { getAppOrigin, getNeonAuthUrl } from "@/integrations/neon/auth-config";

/** 서버(ServerFn)에서 Neon Auth 호출 시 Origin 헤더 필요 */
export function createServerNeonAuth() {
  const origin = getAppOrigin();
  return createAuthClient(getNeonAuthUrl(), {
    adapter: SupabaseAuthAdapter(),
    fetchOptions: {
      headers: {
        Origin: origin,
      },
    },
  });
}
