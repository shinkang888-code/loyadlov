import { createServerFn } from "@tanstack/react-start";
import { DEMO_EMAIL } from "@/lib/demoAuth.constants";
import { ensureDemoAccount } from "@/lib/demoAuth.server";

/** 데모 계정 프로비저닝 — 클라이언트에서 signInWithPassword 호출 전 실행 */
export const demoLoginFn = createServerFn({ method: "POST" }).handler(async () => {
  await ensureDemoAccount();
  return { email: DEMO_EMAIL, ok: true as const };
});
