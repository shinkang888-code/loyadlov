/**
 * ThreadBot cron 워커 — Vercel Cron에서 주기 실행.
 * Meta 피드 수집은 H-07 Render 확장; 현재는 스케줄·dry-run·활동 로그 기록.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateGeminiTextStream } from "@/lib/integrations/gemini.server";

type RulesRow = {
  store_code: string;
  bot_enabled: boolean;
  dry_run: boolean;
  enable_reply: boolean;
  run_interval_minutes: number;
  active_hours_start: string;
  active_hours_end: string;
  tone: string;
  ai_model: string;
  last_run_at: string | null;
};

const TONE_GUIDE: Record<string, string> = {
  friendly: "친근하고 따뜻하게 맞장구치는",
  professional: "정중하고 전문적인 톤으로 공감하는",
  humor: "위트 있고 유쾌하게 맞장구치는",
};

function kstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function inActiveHours(start: string, end: string): boolean {
  const now = kstNow();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = (sh || 0) * 60 + (sm || 0);
  const e = (eh || 23) * 60 + (em || 59);
  if (s <= e) return cur >= s && cur <= e;
  return cur >= s || cur <= e;
}

function intervalElapsed(lastRun: string | null, minutes: number): boolean {
  if (!lastRun) return true;
  const gap = Date.now() - new Date(lastRun).getTime();
  return gap >= minutes * 60 * 1000;
}

async function hasThreadsAccount(storeCode: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("social_accounts")
    .select("id")
    .eq("store_code", storeCode)
    .eq("platform", "threads")
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function logActivity(
  storeCode: string,
  input: {
    action: "like" | "reply" | "skip" | "error";
    status: "success" | "failed" | "dry_run";
    postPreview?: string;
    replyText?: string | null;
    aiReason?: string;
  },
): Promise<void> {
  await supabaseAdmin.from("threadbot_activity_logs").insert({
    store_code: storeCode,
    platform: "threads",
    action: input.action,
    target_username: null,
    post_id: null,
    post_preview: input.postPreview?.slice(0, 500) ?? null,
    reply_text: input.replyText ?? null,
    ai_reason: input.aiReason ?? null,
    status: input.status,
  });
}

async function processStore(row: RulesRow): Promise<{ ok: boolean; reason: string }> {
  if (!row.bot_enabled) return { ok: false, reason: "disabled" };
  if (!inActiveHours(row.active_hours_start, row.active_hours_end)) {
    return { ok: false, reason: "outside_active_hours" };
  }
  if (!intervalElapsed(row.last_run_at, row.run_interval_minutes)) {
    return { ok: false, reason: "interval_not_elapsed" };
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("threadbot_rules")
    .update({ last_run_at: now, updated_at: now })
    .eq("store_code", row.store_code);

  if (row.dry_run) {
    await logActivity(row.store_code, {
      action: "skip",
      status: "dry_run",
      postPreview: "[cron] dry-run tick — Meta API 호출 없음",
      aiReason: "dry_run 모드",
    });
    return { ok: true, reason: "dry_run_tick" };
  }

  const connected = await hasThreadsAccount(row.store_code);
  if (!connected) {
    await logActivity(row.store_code, {
      action: "error",
      status: "failed",
      aiReason: "Threads 계정 미연결 — Admin에서 OAuth 연결 필요 (H-04)",
    });
    return { ok: false, reason: "no_threads_account" };
  }

  // Meta 피드 fetch는 Render/Meta API 확장 — 워커 heartbeat + SKIP 파이프라인 검증
  const samplePost = "오늘 카페 신메뉴 출시! #광고 #협찬";
  const tone = TONE_GUIDE[row.tone] ?? TONE_GUIDE.friendly;
  const prompt = `다음 쓰레드 게시글에 대해 ${tone} 짧은 한국어 댓글 1개를 작성해줘.
- 광고/홍보/분쟁 유발 글이면 "SKIP" 한 단어만 출력
게시글: """${samplePost}"""`;

  const streamed = await generateGeminiTextStream(prompt, {
    model: row.ai_model || undefined,
    temperature: 0.85,
    maxOutputTokens: 128,
  });

  if (streamed.skipped) {
    await logActivity(row.store_code, {
      action: "skip",
      status: "success",
      postPreview: samplePost,
      aiReason: streamed.skipReason ?? "SKIP early abort",
    });
    return { ok: true, reason: "skip_detected" };
  }

  await logActivity(row.store_code, {
    action: "reply",
    status: "success",
    postPreview: samplePost,
    replyText: streamed.text.slice(0, 500),
    aiReason: "cron worker heartbeat (Meta publish pending H-07)",
  });
  return { ok: true, reason: "reply_generated" };
}

export async function runThreadbotCronCycle(): Promise<{
  scanned: number;
  processed: number;
  results: { storeCode: string; reason: string }[];
}> {
  const { data: rows, error } = await supabaseAdmin
    .from("threadbot_rules")
    .select(
      "store_code, bot_enabled, dry_run, enable_reply, run_interval_minutes, active_hours_start, active_hours_end, tone, ai_model, last_run_at",
    )
    .eq("bot_enabled", true);

  if (error) throw new Error(error.message);
  const rules = (rows ?? []) as RulesRow[];
  const results: { storeCode: string; reason: string }[] = [];
  let processed = 0;

  for (const row of rules) {
    const r = await processStore(row);
    results.push({ storeCode: row.store_code, reason: r.reason });
    if (r.ok) processed += 1;
  }

  return { scanned: rules.length, processed, results };
}
