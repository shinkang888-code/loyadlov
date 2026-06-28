import { getAppOrigin, getAuthCallbackUrl, getNeonAuthUrl } from "@/integrations/neon/auth-config";
import { getNeonDb } from "@/integrations/neon/supabase-compat.server";
import { DEMO_EMAIL, DEMO_PROFILE, DEMO_PASSWORD } from "@/lib/demoAuth.constants";

async function findDemoUserId(): Promise<string | null> {
  const db = getNeonDb();
  const { data } = await db.from("profiles").select("id").eq("email", DEMO_EMAIL).maybeSingle();
  const row = data as { id?: string } | null;
  return row?.id ?? null;
}

async function neonAuthPost(path: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${getNeonAuthUrl()}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: getAppOrigin(),
    },
    body: JSON.stringify(body),
  });
}

function readUserId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const user = (payload as { user?: { id?: string } }).user;
  return user?.id ?? null;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/** 서버에서 Neon Auth REST 호출 — SDK getSession() 없이 user.id만 확보 */
async function ensureDemoAuthUserId(): Promise<string> {
  const signIn = await neonAuthPost("sign-in/email", {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (signIn.ok) {
    const id = readUserId(await signIn.json());
    if (id) return id;
  }

  const signUp = await neonAuthPost("sign-up/email", {
    name: DEMO_PROFILE.display_name,
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    callbackURL: getAuthCallbackUrl("/admin"),
    is_demo: true,
    display_name: DEMO_PROFILE.display_name,
    store_code: DEMO_PROFILE.store_code,
  });

  if (signUp.ok) {
    const id = readUserId(await signUp.json());
    if (id) return id;
  } else {
    const msg = await readErrorMessage(signUp);
    if (!/already registered|already been registered|exists/i.test(msg)) {
      throw new Error(msg);
    }
  }

  const retry = await neonAuthPost("sign-in/email", {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (retry.ok) {
    const id = readUserId(await retry.json());
    if (id) return id;
  }

  const fromProfile = await findDemoUserId();
  if (fromProfile) return fromProfile;

  throw new Error("데모 사용자 ID를 확인할 수 없습니다.");
}

/** 데모 계정·프로필·owner 역할 보장 (Neon Auth + Postgres) */
export async function ensureDemoAccount(): Promise<void> {
  const db = getNeonDb();
  const userId = await ensureDemoAuthUserId();

  await db.from("profiles").delete().eq("id", userId);

  const { error: profileErr } = await db.from("profiles").insert({
    id: userId,
    email: DEMO_EMAIL,
    display_name: DEMO_PROFILE.display_name,
    store_code: DEMO_PROFILE.store_code,
    business_name: DEMO_PROFILE.business_name,
    industry: DEMO_PROFILE.industry,
    instagram_handle: DEMO_PROFILE.instagram_handle,
    naver_handle: DEMO_PROFILE.naver_handle,
    onboarded_at: new Date().toISOString(),
  });

  if (profileErr) throw new Error(profileErr.message);

  const { error: roleErr } = await db
    .from("user_roles")
    .upsert({ user_id: userId, role: "owner" }, { onConflict: "user_id,role" });

  if (roleErr) throw new Error(roleErr.message);
}
