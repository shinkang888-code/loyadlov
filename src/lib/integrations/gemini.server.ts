// filepath: src/lib/integrations/gemini.server.ts
/**
 * Google Gemini 직접 연동 (Generative Language API)
 * 키 우선순위: app_settings.platform_secrets.geminiApiKey → env GEMINI_API_KEY
 */
import { resolveGeminiApiKey } from "@/lib/platformSecrets.server";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export type GeminiTextOptions = {
  model?: string;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export async function generateGeminiText(
  prompt: string,
  opts: GeminiTextOptions = {}
): Promise<{ text: string; model: string }> {
  const apiKey = await resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY 미설정 — 관리자 콘솔 'API 연동'에서 키를 입력하세요.");
  }
  const model = opts.model || DEFAULT_GEMINI_MODEL;

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.8,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
    },
  };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }

  const res = await fetch(
    `${BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
  return { text, model };
}

/** 키 유효성 점검 (모델 목록 조회) */
export async function testGemini(): Promise<{ ok: boolean; message: string }> {
  const apiKey = await resolveGeminiApiKey();
  if (!apiKey) return { ok: false, message: "키가 입력되지 않았습니다." };
  try {
    const res = await fetch(`${BASE}/models?key=${encodeURIComponent(apiKey)}`);
    if (res.ok) {
      const json = (await res.json()) as { models?: { name?: string }[] };
      return { ok: true, message: `정상 — 모델 ${json.models?.length ?? 0}개 사용 가능` };
    }
    const detail = await res.text().catch(() => "");
    return { ok: false, message: `오류 ${res.status}: ${detail.slice(0, 120)}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "연결 실패" };
  }
}
