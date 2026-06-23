// filepath: src/lib/members.functions.ts
// 회원(고객) 관리 CRM 서버 함수.
// 목록/등록/수정/삭제/권한 + 통신 스레드(이메일·카카오 송수신).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveRequestedStoreCode } from "@/lib/storeContext.server";
import { logActivity } from "@/lib/activity.server";
import type { Database } from "@/integrations/supabase/types";

const StoreInput = z.object({ storeCode: z.string().trim().optional() });

export const MEMBER_ROLES = ["member", "vip", "staff", "manager", "blocked"] as const;
export const MEMBER_STATUSES = ["active", "inactive", "lead"] as const;
export type MemberRoleType = (typeof MEMBER_ROLES)[number];
export type MemberStatusType = (typeof MEMBER_STATUSES)[number];

export type CrmMember = {
  id: string;
  storeCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  kakaoUserKey: string | null;
  role: MemberRoleType;
  status: MemberStatusType;
  memo: string | null;
  tags: string[];
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemberMessage = {
  id: string;
  memberId: string;
  channel: "email" | "kakao" | "sms" | "note";
  direction: "in" | "out";
  subject: string | null;
  content: string | null;
  status: string;
  createdAt: string;
};

type MemberRow = {
  id: string;
  store_code: string;
  name: string;
  email: string | null;
  phone: string | null;
  kakao_user_key: string | null;
  role: string;
  status: string;
  memo: string | null;
  tags: unknown;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapMember(r: MemberRow): CrmMember {
  return {
    id: r.id,
    storeCode: r.store_code,
    name: r.name,
    email: r.email,
    phone: r.phone,
    kakaoUserKey: r.kakao_user_key,
    role: r.role as MemberRoleType,
    status: r.status as MemberStatusType,
    memo: r.memo,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    lastContactAt: r.last_contact_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const listMemberDirectoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    StoreInput.extend({
      search: z.string().trim().max(120).optional(),
      status: z.enum(MEMBER_STATUSES).optional(),
      role: z.enum(MEMBER_ROLES).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }): Promise<{ members: CrmMember[] }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    let q = supabase
      .from("members")
      .select("*")
      .eq("store_code", storeCode)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status) q = q.eq("status", data.status);
    if (data.role) q = q.eq("role", data.role);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, "");
      q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { members: (rows ?? []).map((r) => mapMember(r as MemberRow)) };
  });

const MemberPatch = {
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  kakaoUserKey: z.string().trim().max(200).optional().or(z.literal("")),
  role: z.enum(MEMBER_ROLES).optional(),
  status: z.enum(MEMBER_STATUSES).optional(),
  memo: z.string().max(4000).optional().or(z.literal("")),
  tags: z.array(z.string().max(40)).max(20).optional(),
};

export const createMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreInput.extend(MemberPatch).parse(input))
  .handler(async ({ data, context }): Promise<{ member: CrmMember }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const { data: row, error } = await supabase
      .from("members")
      .insert({
        store_code: storeCode,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        kakao_user_key: data.kakaoUserKey || null,
        role: data.role ?? "member",
        status: data.status ?? "active",
        memo: data.memo || null,
        tags: data.tags ?? [],
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await logActivity(supabase, {
      actorId: userId,
      storeCode,
      action: "member_created",
      resourceType: "member",
      resourceId: row.id,
      metadata: { name: data.name },
    });
    return { member: mapMember(row as MemberRow) };
  });

export const updateMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: MemberPatch.name.optional(),
        email: MemberPatch.email,
        phone: MemberPatch.phone,
        kakaoUserKey: MemberPatch.kakaoUserKey,
        role: MemberPatch.role,
        status: MemberPatch.status,
        memo: MemberPatch.memo,
        tags: MemberPatch.tags,
      })
      .parse(input)
  )
  .handler(async ({ data, context }): Promise<{ member: CrmMember }> => {
    const { supabase } = context;
    const patch: Database["public"]["Tables"]["members"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) patch.name = data.name;
    if (data.email !== undefined) patch.email = data.email || null;
    if (data.phone !== undefined) patch.phone = data.phone || null;
    if (data.kakaoUserKey !== undefined) patch.kakao_user_key = data.kakaoUserKey || null;
    if (data.role !== undefined) patch.role = data.role;
    if (data.status !== undefined) patch.status = data.status;
    if (data.memo !== undefined) patch.memo = data.memo || null;
    if (data.tags !== undefined) patch.tags = data.tags;

    const { data: row, error } = await supabase
      .from("members")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { member: mapMember(row as MemberRow) };
  });

export const deleteMemberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMemberThreadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ memberId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ messages: MemberMessage[] }> => {
    const { data: rows, error } = await context.supabase
      .from("member_messages")
      .select("id, member_id, channel, direction, subject, content, status, created_at")
      .eq("member_id", data.memberId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return {
      messages: (rows ?? []).map((r) => ({
        id: r.id,
        memberId: r.member_id,
        channel: r.channel as MemberMessage["channel"],
        direction: r.direction as "in" | "out",
        subject: r.subject,
        content: r.content,
        status: r.status,
        createdAt: r.created_at,
      })),
    };
  });

export const sendMemberEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    StoreInput.extend({
      memberId: z.string().uuid(),
      subject: z.string().trim().min(1).max(300),
      content: z.string().trim().min(1).max(20000),
    }).parse(input)
  )
  .handler(async ({ data, context }): Promise<{ message: MemberMessage }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const { data: member, error: mErr } = await supabase
      .from("members")
      .select("id, email, name")
      .eq("id", data.memberId)
      .single();
    if (mErr || !member) throw new Error("회원을 찾을 수 없습니다.");
    if (!member.email) throw new Error("이 회원은 이메일 주소가 없습니다.");

    const html = data.content
      .split("\n")
      .map((line) => `<p style="margin:0 0 8px">${escapeHtml(line) || "&nbsp;"}</p>`)
      .join("");

    let status = "sent";
    let errorMsg: string | null = null;
    try {
      const { sendEmail } = await import("@/lib/integrations/email.server");
      await sendEmail({ to: member.email, subject: data.subject, html });
    } catch (e) {
      status = "failed";
      errorMsg = e instanceof Error ? e.message : "발송 실패";
    }

    const now = new Date().toISOString();
    const { data: row, error } = await supabase
      .from("member_messages")
      .insert({
        member_id: data.memberId,
        store_code: storeCode,
        channel: "email",
        direction: "out",
        subject: data.subject,
        content: data.content,
        status,
        created_by: userId,
        meta: errorMsg ? { error: errorMsg } : {},
      })
      .select("id, member_id, channel, direction, subject, content, status, created_at")
      .single();
    if (error) throw new Error(error.message);

    await supabase
      .from("members")
      .update({ last_contact_at: now, updated_at: now })
      .eq("id", data.memberId);

    if (errorMsg) throw new Error(errorMsg);

    return {
      message: {
        id: row.id,
        memberId: row.member_id,
        channel: "email",
        direction: "out",
        subject: row.subject,
        content: row.content,
        status: row.status,
        createdAt: row.created_at,
      },
    };
  });

export const sendMemberKakaoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    StoreInput.extend({
      memberId: z.string().uuid(),
      content: z.string().trim().min(1).max(2000),
    }).parse(input)
  )
  .handler(async ({ data, context }): Promise<{ message: MemberMessage }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);
    const now = new Date().toISOString();

    const { data: row, error } = await supabase
      .from("member_messages")
      .insert({
        member_id: data.memberId,
        store_code: storeCode,
        channel: "kakao",
        direction: "out",
        content: data.content,
        status: "sent",
        created_by: userId,
      })
      .select("id, member_id, channel, direction, subject, content, status, created_at")
      .single();
    if (error) throw new Error(error.message);

    await supabase
      .from("members")
      .update({ last_contact_at: now, updated_at: now })
      .eq("id", data.memberId);

    return {
      message: {
        id: row.id,
        memberId: row.member_id,
        channel: "kakao",
        direction: "out",
        subject: null,
        content: row.content,
        status: row.status,
        createdAt: row.created_at,
      },
    };
  });

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
