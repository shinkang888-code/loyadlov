import { getNeonDb } from "@/integrations/neon/supabase-compat.server";
import { createAuthClient } from "@neondatabase/auth";
import { SupabaseAuthAdapter } from "@neondatabase/auth/vanilla/adapters";
import { DEMO_EMAIL, DEMO_PROFILE, DEMO_PASSWORD } from "@/lib/demoAuth.constants";

async function findDemoUserId(): Promise<string | null> {
  const db = getNeonDb();
  const { data } = await db.from("profiles").select("id").eq("email", DEMO_EMAIL).maybeSingle();
  const row = data as { id?: string } | null;
  return row?.id ?? null;
}

function getServerNeonAuth() {
  const url = process.env.NEON_AUTH_URL?.trim() || process.env.VITE_NEON_AUTH_URL?.trim();
  if (!url) throw new Error("Missing NEON_AUTH_URL");
  return createAuthClient(url.replace(/\/$/, ""), { adapter: SupabaseAuthAdapter() });
}

/** 데모 계정·프로필·owner 역할 보장 (Neon Auth + Postgres) */
export async function ensureDemoAccount(): Promise<void> {
  const auth = getServerNeonAuth();
  const db = getNeonDb();

  let signIn = await auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (signIn.error) {
    const signUp = await auth.signUp({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      options: {
        data: { ...DEMO_PROFILE, is_demo: true },
      },
    });
    if (signUp.error && !/already registered|already been registered|exists/i.test(signUp.error.message)) {
      throw new Error(signUp.error.message);
    }
    signIn = await auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    if (signIn.error) throw new Error(signIn.error.message);
  }

  let userId = signIn.data.user?.id ?? (await findDemoUserId());
  if (!userId) throw new Error("데모 사용자 ID를 확인할 수 없습니다.");

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
