import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GenInput = z.object({
  store: z.string().trim().min(1).max(120),
  industry: z.string().trim().max(80).optional().default(""),
  tone: z.array(z.string().max(20)).max(5).optional().default([]),
  keyword: z.string().trim().max(120).optional().default(""),
  channel: z.enum(["instagram", "tiktok", "naver", "kakao"]).optional().default("instagram"),
});

export type GenerateContentResult = {
  body: string;
  hashtags: string[];
  model: string;
};

/**
 * Generate SNS post body + hashtags via Lovable AI Gateway (Gemini Flash).
 * Free during the preview window; returns plain DTO.
 */
export const generateContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenInput.parse(input))
  .handler(async ({ data }): Promise<GenerateContentResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const model = "google/gemini-2.5-flash";
    const tone = data.tone.length ? data.tone.join(", ") : "친근하고 신뢰감 있는";
    const channelHint =
      data.channel === "instagram"
        ? "인스타그램 피드 캡션. 2,200자 이내, 줄바꿈 자연스럽게."
        : data.channel === "tiktok"
          ? "틱톡/릴스 짧은 카피. 8줄 이내."
          : data.channel === "naver"
            ? "네이버 플레이스 소식 본문. 정보 위주."
            : "카카오톡 채널 알림. 짧고 명확하게.";

    const system = `너는 한국 자영업 매장의 SNS 콘텐츠 카피라이터다.
- 톤앤매너: ${tone}
- 출력 형식(JSON only, 백틱/설명 금지): {"body": string, "hashtags": string[5..8]}
- 이모지는 1~3개만, 과장 광고 표현·약속·할인 조건 단언 금지.
- 해시태그는 # 포함, 지역+업종+감성 키워드를 섞어라.`;
    const user = `매장명: ${data.store}
업종: ${data.industry || "미지정"}
핵심 키워드: ${data.keyword || "오늘의 메뉴"}
플랫폼: ${data.channel} — ${channelHint}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) {
      return {
        body: "(AI 사용량 한도에 도달했어요. 잠시 후 다시 시도해 주세요.)",
        hashtags: [],
        model,
      };
    }
    if (res.status === 402) {
      return {
        body: "(AI 크레딧이 부족합니다. 워크스페이스 설정에서 크레딧을 추가해 주세요.)",
        hashtags: [],
        model,
      };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("AI gateway error", res.status, text.slice(0, 300));
      throw new Error(`AI gateway ${res.status}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    let body = "";
    let hashtags: string[] = [];
    try {
      const parsed = JSON.parse(raw) as { body?: string; hashtags?: string[] };
      body = (parsed.body ?? "").toString();
      hashtags = Array.isArray(parsed.hashtags)
        ? parsed.hashtags.map((t) => String(t)).filter(Boolean).slice(0, 10)
        : [];
    } catch {
      body = raw;
    }

    return { body, hashtags, model };
  });
