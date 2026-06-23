// filepath: src/lib/integrations/openai.server.ts
/**
 * OpenAI (ChatGPT) 직접 연동 — Chat Completions API
 * 키 우선순위: app_settings.platform_secrets.openaiApiKey → env OPENAI_API_KEY
 */
import { resolveOpenAiApiKey } from "@/lib/platformSecrets.server";

const BASE = "https://api.openai.com/v1";

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export type OpenAiTextOptions = {
  model?: string;
  system?: string;
  temperature?: number;
  jsonMode?: boolean;
};

export async function generateOpenAiText(
  prompt: string,
  opts: OpenAiTextOptions = {}
): Promise<{ text: string; model: string }> {
  const apiKey = await resolveOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 미설정 — 관리자 콘솔 'API 연동'에서 키를 입력하세요.");
  }
  const model = opts.model || DEFAULT_OPENAI_MODEL;

  const messages: { role: string; content: string }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: prompt });

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.8,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  return { text, model };
}

/** 키 유효성 점검 (모델 목록 조회) */
export async function testOpenAi(): Promise<{ ok: boolean; message: string }> {
  const apiKey = await resolveOpenAiApiKey();
  if (!apiKey) return { ok: false, message: "키가 입력되지 않았습니다." };
  try {
    const res = await fetch(`${BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: unknown[] };
      return { ok: true, message: `정상 — 모델 ${json.data?.length ?? 0}개 사용 가능` };
    }
    const detail = await res.text().catch(() => "");
    return { ok: false, message: `오류 ${res.status}: ${detail.slice(0, 120)}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "연결 실패" };
  }
}
