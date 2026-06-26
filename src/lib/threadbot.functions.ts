// filepath: src/lib/threadbot.functions.ts
// 쓰레드봇(ThreadBot) 대시보드 서버 함수.
// 규칙 CRUD / 봇 토글 / 활동 로그 / 요약(KPI) / AI 댓글 생성(Gemini 실연동).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveRequestedStoreCode } from "@/lib/storeContext.server";
import type { Database } from "@/integrations/supabase/types";
import { generateGeminiText } from "@/lib/integrations/gemini.server";

const StoreInput = z.object({ storeCode: z.string().trim().optional() });

export type ThreadbotRules = {
  storeCode: string;
  botEnabled: boolean;
  dryRun: boolean;
  enableLike: boolean;
  enableReply: boolean;
  dailyLikeLimit: number;
  dailyReplyLimit: number;
  runIntervalMinutes: number;
  activeHoursStart: string;
  activeHoursEnd: string;
  keywordsInclude: string[];
  keywordsExclude: string[];
  tone: "friendly" | "professional" | "humor";
  minPostLength: number;
  aiModel: string;
  lastRunAt: string | null;
};

export type ThreadbotActivity = {
  id: string;
  platform: "threads" | "instagram";
  action: "like" | "reply" | "skip" | "error";
  targetUsername: string | null;
  postId: string | null;
  postPreview: string | null;
  replyText: string | null;
  aiReason: string | null;
  status: "success" | "failed" | "dry_run";
  createdAt: string;
};

type RulesRow = Database["public"]["Tables"]["threadbot_rules"]["Row"];
type ActivityRow = Database["public"]["Tables"]["threadbot_activity_logs"]["Row"];

function toStrArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}

function mapRules(row: RulesRow): ThreadbotRules {
  return {
    storeCode: row.store_code,
    botEnabled: row.bot_enabled,
    dryRun: row.dry_run,
    enableLike: row.enable_like,
    enableReply: row.enable_reply,
    dailyLikeLimit: row.daily_like_limit,
    dailyReplyLimit: row.daily_reply_limit,
    runIntervalMinutes: row.run_interval_minutes,
    activeHoursStart: row.active_hours_start,
    activeHoursEnd: row.active_hours_end,
    keywordsInclude: toStrArray(row.keywords_include),
    keywordsExclude: toStrArray(row.keywords_exclude),
    tone: (row.tone as ThreadbotRules["tone"]) ?? "friendly",
    minPostLength: row.min_post_length,
    aiModel: row.ai_model,
    lastRunAt: row.last_run_at,
  };
}

function defaultRules(storeCode: string): ThreadbotRules {
  return {
    storeCode,
    botEnabled: false,
    dryRun: true,
    enableLike: true,
    enableReply: true,
    dailyLikeLimit: 20,
    dailyReplyLimit: 10,
    runIntervalMinutes: 120,
    activeHoursStart: "09:00",
    activeHoursEnd: "23:00",
    keywordsInclude: [],
    keywordsExclude: ["광고", "홍보", "이벤트", "당첨"],
    tone: "friendly",
    minPostLength: 15,
    aiModel: "gemini-2.5-flash",
    lastRunAt: null,
  };
}

function mapActivity(row: ActivityRow): ThreadbotActivity {
  return {
    id: row.id,
    platform: (row.platform as ThreadbotActivity["platform"]) ?? "threads",
    action: row.action as ThreadbotActivity["action"],
    targetUsername: row.target_username,
    postId: row.post_id,
    postPreview: row.post_preview,
    replyText: row.reply_text,
    aiReason: row.ai_reason,
    status: (row.status as ThreadbotActivity["status"]) ?? "success",
    createdAt: row.created_at,
  };
}

// ── 규칙 조회 (없으면 생성) ──────────────────────────────
export const getThreadbotRulesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreInput.parse(input))
  .handler(async ({ data, context }): Promise<{ rules: ThreadbotRules }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const { data: row } = await supabase
      .from("threadbot_rules")
      .select("*")
      .eq("store_code", storeCode)
      .maybeSingle();

    if (row) return { rules: mapRules(row as RulesRow) };

    const { data: created } = await supabase
      .from("threadbot_rules")
      .insert({ store_code: storeCode })
      .select("*")
      .single();
    return {
      rules: created ? mapRules(created as RulesRow) : defaultRules(storeCode),
    };
  });

// ── 규칙 저장 ────────────────────────────────────────────
const SaveRulesInput = z.object({
  storeCode: z.string().trim().optional(),
  patch: z.object({
    dryRun: z.boolean().optional(),
    enableLike: z.boolean().optional(),
    enableReply: z.boolean().optional(),
    dailyLikeLimit: z.number().int().min(0).max(200).optional(),
    dailyReplyLimit: z.number().int().min(0).max(200).optional(),
    runIntervalMinutes: z.number().int().min(15).max(1440).optional(),
    activeHoursStart: z.string().optional(),
    activeHoursEnd: z.string().optional(),
    keywordsInclude: z.array(z.string()).optional(),
    keywordsExclude: z.array(z.string()).optional(),
    tone: z.enum(["friendly", "professional", "humor"]).optional(),
    minPostLength: z.number().int().min(0).max(500).optional(),
    aiModel: z.string().optional(),
  }),
});

export const saveThreadbotRulesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveRulesInput.parse(input))
  .handler(async ({ data, context }): Promise<{ rules: ThreadbotRules }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);
    const p = data.patch;

    const update: Database["public"]["Tables"]["threadbot_rules"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (p.dryRun !== undefined) update.dry_run = p.dryRun;
    if (p.enableLike !== undefined) update.enable_like = p.enableLike;
    if (p.enableReply !== undefined) update.enable_reply = p.enableReply;
    if (p.dailyLikeLimit !== undefined) update.daily_like_limit = p.dailyLikeLimit;
    if (p.dailyReplyLimit !== undefined) update.daily_reply_limit = p.dailyReplyLimit;
    if (p.runIntervalMinutes !== undefined) update.run_interval_minutes = p.runIntervalMinutes;
    if (p.activeHoursStart !== undefined) update.active_hours_start = p.activeHoursStart;
    if (p.activeHoursEnd !== undefined) update.active_hours_end = p.activeHoursEnd;
    if (p.keywordsInclude !== undefined) update.keywords_include = p.keywordsInclude;
    if (p.keywordsExclude !== undefined) update.keywords_exclude = p.keywordsExclude;
    if (p.tone !== undefined) update.tone = p.tone;
    if (p.minPostLength !== undefined) update.min_post_length = p.minPostLength;
    if (p.aiModel !== undefined) update.ai_model = p.aiModel;

    const upsert: Database["public"]["Tables"]["threadbot_rules"]["Insert"] = {
      store_code: storeCode,
      ...update,
    };

    const { data: row, error } = await supabase
      .from("threadbot_rules")
      .upsert(upsert, { onConflict: "store_code" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { rules: mapRules(row as RulesRow) };
  });

// ── 봇 ON/OFF 토글 ──────────────────────────────────────
const ToggleInput = z.object({
  storeCode: z.string().trim().optional(),
  enabled: z.boolean(),
});

export const toggleThreadbotFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ToggleInput.parse(input))
  .handler(async ({ data, context }): Promise<{ botEnabled: boolean }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);
    const { error } = await supabase
      .from("threadbot_rules")
      .upsert(
        { store_code: storeCode, bot_enabled: data.enabled, updated_at: new Date().toISOString() },
        { onConflict: "store_code" }
      );
    if (error) throw new Error(error.message);
    return { botEnabled: data.enabled };
  });

// ── 활동 로그 조회 ──────────────────────────────────────
const ListActivityInput = z.object({
  storeCode: z.string().trim().optional(),
  action: z.enum(["all", "like", "reply", "skip", "error"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const listThreadbotActivityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListActivityInput.parse(input))
  .handler(async ({ data, context }): Promise<{ items: ThreadbotActivity[] }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    let q = supabase
      .from("threadbot_activity_logs")
      .select("*")
      .eq("store_code", storeCode)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.action && data.action !== "all") q = q.eq("action", data.action);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: (rows ?? []).map((r) => mapActivity(r as ActivityRow)) };
  });

// ── 요약(KPI) — 오늘 공감/댓글/스킵/실패 ────────────────
export type ThreadbotSummary = {
  likes: number;
  replies: number;
  skips: number;
  errors: number;
};

export type ThreadbotAccount = {
  platform: "threads" | "instagram";
  username: string | null;
  status: "connected" | "expired" | "disconnected" | "needs_business";
  expiresInDays: number | null;
};

function expiresInDays(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

function deriveAccountStatus(
  platform: "threads" | "instagram",
  social: { display_name: string; token_expires_at: string | null; metadata: unknown } | undefined,
  meta: Record<string, unknown>
): ThreadbotAccount["status"] {
  if (!social) return "disconnected";
  if (platform === "instagram" && !meta.instagramBusinessAccountId) return "needs_business";
  if (platform === "threads" && !meta.threadsUserId) return "disconnected";
  if (social.token_expires_at && new Date(social.token_expires_at).getTime() < Date.now()) {
    return "expired";
  }
  return "connected";
}

function mapThreadbotAccount(
  platform: "threads" | "instagram",
  social: { display_name: string; platform_user_id: string; token_expires_at: string | null; metadata: unknown } | undefined,
  meta: Record<string, unknown>
): ThreadbotAccount {
  const status = deriveAccountStatus(platform, social, meta);
  const username =
    platform === "threads"
      ? social?.display_name ?? (meta.threadsUsername ? `@${meta.threadsUsername}` : null)
      : social?.display_name ?? null;
  return {
    platform,
    username: status === "disconnected" ? null : username,
    status,
    expiresInDays: status === "connected" ? expiresInDays(social?.token_expires_at ?? null) : null,
  };
}

export const getThreadbotSummaryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreInput.parse(input))
  .handler(async ({ data, context }): Promise<{ summary: ThreadbotSummary }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const { data: rows } = await supabase
      .from("threadbot_activity_logs")
      .select("action")
      .eq("store_code", storeCode)
      .gte("created_at", since.toISOString());

    const summary: ThreadbotSummary = { likes: 0, replies: 0, skips: 0, errors: 0 };
    for (const r of rows ?? []) {
      const a = (r as { action: string }).action;
      if (a === "like") summary.likes++;
      else if (a === "reply") summary.replies++;
      else if (a === "skip") summary.skips++;
      else if (a === "error") summary.errors++;
    }
    return { summary };
  });

// ── 연동 계정 (social_accounts → threadbot_accounts 동기화) ──
export const listThreadbotAccountsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreInput.parse(input))
  .handler(async ({ data, context }): Promise<{ accounts: ThreadbotAccount[] }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const { data: socialRows } = await supabase
      .from("social_accounts")
      .select("platform, display_name, platform_user_id, token_expires_at, metadata")
      .eq("store_code", storeCode)
      .in("platform", ["threads", "instagram"]);

    const threadsSocial = socialRows?.find((r) => r.platform === "threads");
    const instagramSocial = socialRows?.find((r) => r.platform === "instagram");
    const sharedMeta =
      (threadsSocial?.metadata as Record<string, unknown> | null) ??
      (instagramSocial?.metadata as Record<string, unknown> | null) ??
      {};

    const accounts: ThreadbotAccount[] = [
      mapThreadbotAccount("threads", threadsSocial, sharedMeta),
      mapThreadbotAccount("instagram", instagramSocial, sharedMeta),
    ];

    const now = new Date().toISOString();
    for (const acc of accounts) {
      const social = acc.platform === "threads" ? threadsSocial : instagramSocial;
      const upsert: Database["public"]["Tables"]["threadbot_accounts"]["Insert"] = {
        store_code: storeCode,
        platform: acc.platform,
        username: acc.username,
        external_user_id: social?.platform_user_id ?? null,
        status: acc.status,
        expires_at: social?.token_expires_at ?? null,
        connected_at: acc.status === "connected" ? now : null,
        updated_at: now,
      };
      await supabase.from("threadbot_accounts").upsert(upsert, { onConflict: "store_code,platform" });
    }

    return { accounts };
  });

// ── 수동 활동 로그 기록 (피드 공감/댓글/스킵) ───────────
const LogActivityInput = z.object({
  storeCode: z.string().trim().optional(),
  platform: z.enum(["threads", "instagram"]),
  action: z.enum(["like", "reply", "skip", "error"]),
  targetUsername: z.string().optional().nullable(),
  postId: z.string().optional().nullable(),
  postPreview: z.string().optional().nullable(),
  replyText: z.string().optional().nullable(),
  aiReason: z.string().optional().nullable(),
  status: z.enum(["success", "failed", "dry_run"]).optional(),
});

export const logThreadbotActivityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LogActivityInput.parse(input))
  .handler(async ({ data, context }): Promise<{ activity: ThreadbotActivity }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);

    const { data: rulesRow } = await supabase
      .from("threadbot_rules")
      .select("dry_run")
      .eq("store_code", storeCode)
      .maybeSingle();

    const status =
      data.status ?? (rulesRow?.dry_run ? "dry_run" : "success");

    const insert: Database["public"]["Tables"]["threadbot_activity_logs"]["Insert"] = {
      store_code: storeCode,
      platform: data.platform,
      action: data.action,
      target_username: data.targetUsername ?? null,
      post_id: data.postId ?? null,
      post_preview: data.postPreview ?? null,
      reply_text: data.replyText ?? null,
      ai_reason: data.aiReason ?? null,
      status,
    };

    const { data: row, error } = await supabase
      .from("threadbot_activity_logs")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { activity: mapActivity(row as ActivityRow) };
  });

// ── AI 댓글 생성 (Gemini 실연동) ────────────────────────
const TONE_GUIDE: Record<ThreadbotRules["tone"], string> = {
  friendly: "친근하고 따뜻하게 맞장구치는",
  professional: "정중하고 전문적인 톤으로 공감하는",
  humor: "위트 있고 유쾌하게 맞장구치는",
};

const ReplyInput = z.object({
  storeCode: z.string().trim().optional(),
  postText: z.string().min(1),
  tone: z.enum(["friendly", "professional", "humor"]).optional(),
  model: z.string().optional(),
});

export const generateThreadReplyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReplyInput.parse(input))
  .handler(async ({ data }): Promise<{ reply: string; reason: string; model: string }> => {
    const tone = data.tone ?? "friendly";
    const guide = TONE_GUIDE[tone];
    const prompt = `다음 쓰레드(Threads) 게시글에 대해 ${guide} 짧은 한국어 댓글 1개를 작성해줘.
- 해시태그 없이
- 1~2문장, 자연스럽게
- 광고/홍보/분쟁 유발 글이면 댓글 대신 "SKIP" 한 단어만 출력

게시글: """${data.postText}"""`;

    const { text, model } = await generateGeminiText(prompt, {
      model: data.model,
      temperature: 0.85,
      maxOutputTokens: 256,
    });
    const reply = text.trim();
    if (reply.toUpperCase() === "SKIP" || reply === "") {
      return { reply: "", reason: "광고·홍보·분쟁성 글로 판단되어 스킵", model };
    }
    return { reply, reason: `${TONE_GUIDE[tone]} 댓글 생성`, model };
  });

// ── 수동 1회 실행 (마지막 실행 시각 기록) ───────────────
// 실제 Threads 자동화 워커는 별도 백엔드(Render Worker/Meta API)에서 수행한다.
// 여기서는 last_run_at 을 갱신하고 안내 메시지를 반환한다.
export const runThreadbotOnceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoreInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    const { supabase, userId } = context;
    const storeCode = await resolveRequestedStoreCode(supabase, userId, data.storeCode);
    const now = new Date().toISOString();
    await supabase
      .from("threadbot_rules")
      .upsert(
        { store_code: storeCode, last_run_at: now, updated_at: now },
        { onConflict: "store_code" }
      );
    return {
      ok: true,
      message:
        "실행 요청을 큐에 등록했습니다. 실제 공감·댓글은 봇 워커(Meta API/브라우저)가 처리하며 활동 로그에 기록됩니다.",
    };
  });
