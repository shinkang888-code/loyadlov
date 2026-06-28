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

export type GeminiStreamResult = {
  text: string;
  model: string;
  skipped: boolean;
  skipReason?: string;
};

/** ThreadBot SKIP 조기 중단 — 첫 토큰 블록에서 ^SKIP\b 감지 시 스트림 abort */
export async function generateGeminiTextStream(
  prompt: string,
  opts: GeminiTextOptions & { skipToken?: RegExp } = {},
): Promise<GeminiStreamResult> {
  const apiKey = await resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY 미설정 — 관리자 콘솔 'API 연동'에서 키를 입력하세요.");
  }
  const model = opts.model || DEFAULT_GEMINI_MODEL;
  const skipRe = opts.skipToken ?? /^SKIP\b/i;

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.8,
      maxOutputTokens: opts.maxOutputTokens ?? 512,
    },
  };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }

  const res = await fetch(
    `${BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini stream ${res.status}: ${detail.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Gemini stream: empty body");

  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const chunk = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        if (!chunk) continue;
        accumulated += chunk;
        const head = accumulated.trim().slice(0, 24);
        if (skipRe.test(head)) {
          await reader.cancel();
          return { text: "", model, skipped: true, skipReason: "SKIP token detected" };
        }
      } catch {
        /* partial SSE line */
      }
    }
  }

  return { text: accumulated.trim(), model, skipped: false };
}

// === 이미지 생성 (Nano Banana 계열) ===
// Nano Banana       = gemini-2.5-flash-image
// Nano Banana Pro   = gemini-3-pro-image-preview
// Nano Banana 2     = gemini-3.1-flash-image-preview
export const NANO_BANANA_MODELS = {
  "nano-banana": "gemini-2.5-flash-image",
  "nano-banana-pro": "gemini-3-pro-image-preview",
  "nano-banana-2": "gemini-3.1-flash-image-preview",
} as const;

export type NanoBananaModel = keyof typeof NANO_BANANA_MODELS;

export const DEFAULT_NANO_BANANA_MODEL = "gemini-2.5-flash-image";

/**
 * Gemini Nano Banana 텍스트→이미지 생성.
 * 결과는 base64 data URL 로 반환한다.
 */
export async function generateGeminiImage(
  prompt: string,
  opts: { model?: string } = {}
): Promise<{ dataUrl: string; mimeType: string; model: string }> {
  const apiKey = await resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY 미설정 — 관리자 콘솔 'API 연동'에서 키를 입력하세요.");
  }
  const model = opts.model || DEFAULT_NANO_BANANA_MODEL;

  const res = await fetch(
    `${BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini 이미지 ${res.status}: ${detail.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    candidates?: {
      content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
    }[];
  };
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error("Gemini 이미지 응답에 이미지 데이터가 없습니다 (안전 필터 차단 가능).");
  }
  const mimeType = imagePart.inlineData.mimeType || "image/png";
  return {
    dataUrl: `data:${mimeType};base64,${imagePart.inlineData.data}`,
    mimeType,
    model,
  };
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
