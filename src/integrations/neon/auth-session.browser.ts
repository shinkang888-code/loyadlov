import { getNeonAuthClientUrl } from "@/integrations/neon/auth-config";

/** Supabase Auth 호환 세션 (access_token + user) */
export type BrowserAuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
  user: {
    id: string;
    email: string;
    app_metadata: Record<string, unknown>;
    user_metadata: Record<string, unknown>;
    aud: string;
    role: string;
    created_at: string;
    updated_at: string;
    identities: unknown[];
  };
};

let memorySession: BrowserAuthSession | null = null;

export function getMemoryAuthSession(): BrowserAuthSession | null {
  return memorySession;
}

export function setMemoryAuthSession(session: BrowserAuthSession | null): void {
  memorySession = session;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return value;
  return new Date().toISOString();
}

export function buildSessionFromSignInBody(body: {
  token: string;
  user: Record<string, unknown>;
}): BrowserAuthSession {
  const user = body.user;
  const createdAt = toIso(user.createdAt ?? user.created_at);
  const updatedAt = toIso(user.updatedAt ?? user.updated_at);
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;

  const userMetadata: Record<string, unknown> = {};
  if (typeof user.name === "string") userMetadata.displayName = user.name;
  if (typeof user.image === "string") userMetadata.profileImageUrl = user.image;
  for (const [key, value] of Object.entries(user)) {
    if (!["id", "email", "emailVerified", "name", "image", "createdAt", "updatedAt"].includes(key)) {
      userMetadata[key] = value;
    }
  }

  return {
    access_token: body.token,
    refresh_token: "",
    expires_at: expiresAt,
    expires_in: expiresAt - Math.floor(Date.now() / 1000),
    token_type: "bearer",
    user: {
      id: String(user.id),
      email: String(user.email ?? ""),
      app_metadata: {},
      user_metadata: userMetadata,
      aud: "authenticated",
      role: "authenticated",
      created_at: createdAt,
      updated_at: updatedAt,
      identities: [],
    },
  };
}

/** sign-in/email → get-session 또는 sign-in body 로 세션 복구 */
export async function recoverSessionFromSignIn(credentials: {
  email: string;
  password: string;
}): Promise<BrowserAuthSession | null> {
  const base = getNeonAuthClientUrl();
  const signInRes = await fetch(`${base}/sign-in/email`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: credentials.email, password: credentials.password }),
  });
  if (!signInRes.ok) return null;

  const body = (await signInRes.json()) as { token?: string; user?: Record<string, unknown> };
  if (!body.token || !body.user) return null;

  const sessRes = await fetch(`${base}/get-session`, { credentials: "include" });
  if (sessRes.ok) {
    const sess = (await sessRes.json()) as {
      session?: { token?: string; expiresAt?: string };
      user?: Record<string, unknown>;
    };
    if (sess.session?.token && sess.user) {
      return buildSessionFromSignInBody({ token: sess.session.token, user: sess.user });
    }
  }

  return buildSessionFromSignInBody({ token: body.token, user: body.user });
}
