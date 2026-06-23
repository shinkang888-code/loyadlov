import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEMO_EMAIL, DEMO_PROFILE } from "@/lib/demoAuth.constants";

const DEMO_PASSWORD = "LoyardDemo2026!";

async function findDemoUserId(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", DEMO_EMAIL)
    .maybeSingle();
  return data?.id ?? null;
}

/** 데모 계정·프로필·owner 역할을 보장 (service role) */
export async function ensureDemoAccount(): Promise<void> {
  let userId = await findDemoUserId();

  if (!userId) {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: DEMO_PROFILE.display_name,
        is_demo: true,
      },
    });

    if (error) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = list.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL.toLowerCase());
      if (!found) throw new Error(error.message);
      userId = found.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD });
    } else {
      userId = created.user!.id;
    }
  } else {
    await supabaseAdmin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD });
  }

  const { error: profileErr } = await supabaseAdmin
    .from("profiles")
    .update({
      email: DEMO_EMAIL,
      display_name: DEMO_PROFILE.display_name,
      store_code: DEMO_PROFILE.store_code,
      business_name: DEMO_PROFILE.business_name,
      industry: DEMO_PROFILE.industry,
      instagram_handle: DEMO_PROFILE.instagram_handle,
      naver_handle: DEMO_PROFILE.naver_handle,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileErr) throw new Error(profileErr.message);

  const { error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "owner" }, { onConflict: "user_id,role" });

  if (roleErr) throw new Error(roleErr.message);
}
