import { createAuthClient } from "@neondatabase/auth";
import { SupabaseAuthAdapter } from "@neondatabase/auth/vanilla/adapters";
import { getNeonAuthUrl } from "@/integrations/neon/auth-config";

function createNeonAuthClient() {
  return createAuthClient(getNeonAuthUrl(), {
    adapter: SupabaseAuthAdapter(),
  });
}

let _auth: ReturnType<typeof createNeonAuthClient> | undefined;

function getNeonAuth() {
  if (!_auth) _auth = createNeonAuthClient();
  return _auth;
}

/** Supabase SDK 호환 — Neon Auth (브라우저) */
export const supabase = {
  get auth() {
    return getNeonAuth();
  },
  channel(_name: string) {
    const noop = { on: () => noop, subscribe: () => "ok" as const };
    return noop;
  },
  removeChannel(_channel: unknown) {
    return Promise.resolve();
  },
  from(table: string) {
    throw new Error(
      `Client-side DB access (${table}) is disabled. Use server functions with Neon Postgres.`,
    );
  },
};

export { getNeonAuthUrl, NEON_AUTH_JWKS_URL } from "@/integrations/neon/auth-config";
