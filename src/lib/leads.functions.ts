import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getNeonDb } from "@/integrations/neon/supabase-compat.server";
import { requireNeonAuth } from "@/integrations/neon/auth-middleware.server";
import { isUserAdmin } from "@/lib/storeContext.server";

const ContactInput = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(30),
  store_name: z.string().trim().max(120).optional(),
  industry: z.string().trim().max(60).optional(),
  message: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(40).optional(),
});

/** 랜딩 문의 폼 — 인증 불필요 */
export const submitContactFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ContactInput.parse(input))
  .handler(async ({ data }) => {
    const db = getNeonDb();
    const { error } = await db.from("contact_submissions").insert({
      name: data.name,
      phone: data.phone,
      store_name: data.store_name || null,
      industry: data.industry || null,
      message: data.message || null,
      source: data.source ?? "landing",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type LeadRow = {
  id: string;
  name: string;
  phone: string;
  store_name: string | null;
  industry: string | null;
  message: string | null;
  status: "new" | "contacted" | "converted" | "dropped";
  admin_note: string | null;
  source: string | null;
  created_at: string;
};

const UpdateLeadInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "contacted", "converted", "dropped"]).optional(),
  admin_note: z.string().max(2000).nullable().optional(),
});

/** Admin — 랜딩 상담 리드 목록 */
export const listLeadsFn = createServerFn({ method: "POST" })
  .middleware([requireNeonAuth])
  .handler(async ({ context }) => {
    if (!(await isUserAdmin(context.db, context.userId))) {
      throw new Error("관리자 권한이 필요합니다.");
    }
    const db = getNeonDb();
    const { data, error } = await db
      .from("contact_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { leads: (data ?? []) as LeadRow[] };
  });

export const updateLeadFn = createServerFn({ method: "POST" })
  .middleware([requireNeonAuth])
  .inputValidator((input: unknown) => UpdateLeadInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isUserAdmin(context.db, context.userId))) {
      throw new Error("관리자 권한이 필요합니다.");
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.status) patch.status = data.status;
    if (data.admin_note !== undefined) patch.admin_note = data.admin_note;

    const { error } = await getNeonDb().from("contact_submissions").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
