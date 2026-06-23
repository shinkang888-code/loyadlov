// filepath: src/lib/integrations/llm.server.ts
/**
 * 통합 텍스트 생성 게이트웨이 — Lovable / Gemini / OpenAI 중 선택.
 * 관리자 콘솔 'API 연동'에서 입력한 키로 동작한다.
 */
import { resolveLovableApiKey } from "@/lib/platformSecrets.server";
import { generateGeminiText } from "@/lib/integrations/gemini.server";
import { generateOpenAiText } from "@/lib/integrations/openai.server";

export type TextProvider = "lovable" | "gemini" | "openai";

export const TEXT_PROVIDERS: TextProvider[] = ["lovable", "gemini", "openai"];

export type GenerateTextInput = {
  provider: TextProvider;
  prompt: string;
  system?: string;
  model?: string;
};

async function generateLovableText(
  prompt: string,
  system?: string,
  model = "google/gemini-2.5-flash"
): Promise<{ text: string; model: string }> {
  const apiKey = await resolveLovableApiKey();
  if (!apiKey) {
    throw new Error("LOVABLE_API_KEY 미설정 — 관리자 콘솔 'API 연동'에서 키를 입력하세요.");
  }
  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Lovable ${res.status}: ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return { text: json.choices?.[0]?.message?.content?.trim() ?? "", model };
}

export async function generateText(
  input: GenerateTextInput
): Promise<{ text: string; model: string; provider: TextProvider }> {
  const { provider, prompt, system, model } = input;
  if (provider === "gemini") {
    const r = await generateGeminiText(prompt, { system, model });
    return { ...r, provider };
  }
  if (provider === "openai") {
    const r = await generateOpenAiText(prompt, { system, model });
    return { ...r, provider };
  }
  const r = await generateLovableText(prompt, system, model);
  return { ...r, provider: "lovable" };
}
