import { createAuthClient } from "@neondatabase/auth";
import { SupabaseAuthAdapter } from "@neondatabase/auth/vanilla/adapters";
import { getNeonAuthClientUrl } from "@/integrations/neon/auth-config";
import {
  getMemoryAuthSession,
  recoverSessionFromSignIn,
  setMemoryAuthSession,
} from "@/integrations/neon/auth-session.browser";

type AuthClient = ReturnType<typeof createAuthClient>;

function createBaseAuthClient(): AuthClient {
  return createAuthClient(getNeonAuthClientUrl(), {
    adapter: SupabaseAuthAdapter(),
  });
}

function wrapBrowserAuth(base: AuthClient): AuthClient {
  if (typeof window === "undefined") return base;

  const wrapped = base as AuthClient & {
    signInWithPassword: AuthClient["signInWithPassword"];
    signUp: AuthClient["signUp"];
    getSession: AuthClient["getSession"];
    getUser: AuthClient["getUser"];
  };

  const baseSignIn = base.signInWithPassword.bind(base);
  wrapped.signInWithPassword = async (credentials) => {
    const result = await baseSignIn(credentials);
    if (!result.error && result.data.session) {
      setMemoryAuthSession(result.data.session);
      return result;
    }

    const msg = result.error?.message ?? "";
    if (msg.includes("Failed to retrieve user session") && "email" in credentials && credentials.email) {
      const recovered = await recoverSessionFromSignIn({
        email: credentials.email,
        password: credentials.password,
      });
      if (recovered) {
        setMemoryAuthSession(recovered);
        return {
          data: { user: recovered.user, session: recovered },
          error: null,
        };
      }
    }
    return result;
  };

  const baseSignUp = base.signUp.bind(base);
  wrapped.signUp = async (credentials) => {
    const result = await baseSignUp(credentials);
    if (!result.error && result.data.session) {
      setMemoryAuthSession(result.data.session);
      return result;
    }

    const msg = result.error?.message ?? "";
    if (
      msg.includes("Failed to retrieve user session") &&
      "email" in credentials &&
      credentials.email &&
      credentials.password
    ) {
      const recovered = await recoverSessionFromSignIn({
        email: credentials.email,
        password: credentials.password,
      });
      if (recovered) {
        setMemoryAuthSession(recovered);
        return {
          data: { user: recovered.user, session: recovered },
          error: null,
        };
      }
    }
    return result;
  };

  const baseGetSession = base.getSession.bind(base);
  wrapped.getSession = async (options) => {
    const cached = getMemoryAuthSession();
    if (cached) return { data: { session: cached }, error: null };

    const result = await baseGetSession(options);
    if (result.data.session) setMemoryAuthSession(result.data.session);
    return result;
  };

  const baseGetUser = base.getUser.bind(base);
  wrapped.getUser = async () => {
    const cached = getMemoryAuthSession();
    if (cached?.user) return { data: { user: cached.user }, error: null };
    return baseGetUser();
  };

  const baseSignOut = base.signOut.bind(base);
  wrapped.signOut = async (options) => {
    setMemoryAuthSession(null);
    return baseSignOut(options);
  };

  return wrapped;
}

let _auth: AuthClient | undefined;

function getNeonAuth(): AuthClient {
  if (!_auth) _auth = wrapBrowserAuth(createBaseAuthClient());
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

export {
  getNeonAuthUrl,
  getNeonAuthClientUrl,
  getAppOrigin,
  getAuthCallbackUrl,
  NEON_AUTH_JWKS_URL,
} from "@/integrations/neon/auth-config";
