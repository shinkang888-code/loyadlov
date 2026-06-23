import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEMO_EMAIL } from "@/lib/demoAuth.constants";
import { ensureDemoAccount } from "@/lib/demoAuth.server";

export const demoLoginFn = createServerFn({ method: "POST" }).handler(async () => {
  await ensureDemoAccount();

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: DEMO_EMAIL,
  });

  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    throw new Error(error?.message ?? "데모 세션을 만들 수 없습니다.");
  }

  return { tokenHash };
});
