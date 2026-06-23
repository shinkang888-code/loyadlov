import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StoryboardInput = z.object({
  store: z.string().trim().min(1).max(120),
  industry: z.string().trim().max(80).optional().default(""),
  keyword: z.string().trim().max(120).optional().default(""),
  caption: z.string().trim().max(4000).optional().default(""),
  platform: z.enum(["tiktok", "youtube"]).optional().default("tiktok"),
});

export type VideoStoryboardResult = {
  hook: string;
  scenes: { durationSec: number; visual: string; onScreenText: string }[];
  caption: string;
  hashtags: string[];
  model: string;
  note: string;
};

/**
 * AI 숏폼 스토리보드 생성 (Lovable Gateway).
 * 실제 영상 렌더링은 RUNWAY_API_KEY 등 외부 API 연동 시 Phase 7에서 확장.
 */
export const generateVideoStoryboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoryboardInput.parse(input))
  .handler(async ({ data }): Promise<VideoStoryboardResult> => {
    const { resolveLovableApiKey } = await import("@/lib/platformSecrets.server");
    const apiKey = await resolveLovableApiKey();
    const model = "google/gemini-2.5-flash";
    const platformLabel = data.platform === "youtube" ? "YouTube Shorts" : "TikTok Reels";

    if (!apiKey) {
      return {
        hook: `${data.keyword || data.store} — 3초 훅`,
        scenes: [
          { durationSec: 3, visual: "매장 외관 또는 시그니처 메뉴 클로즈업", onScreenText: data.keyword || "오늘의 추천" },
          { durationSec: 5, visual: "조리/플레이팅 B-roll", onScreenText: "직접 만듭니다" },
          { durationSec: 7, visual: "손님 반응 또는 완성 샷", onScreenText: "지금 방문하세요" },
        ],
        caption: data.caption || `${data.store} ${data.keyword}`.trim(),
        hashtags: ["#릴스", "#숏츠", "#맛집"],
        model: "fallback",
        note: "LOVABLE API 키 미설정 — 설정 탭에서 키를 입력하세요. mp4 URL을 직접 입력해 발행할 수 있습니다.",
      };
    }

    const system = `너는 ${platformLabel} 숏폼 영상 PD다.
JSON only: {"hook":string,"scenes":[{"durationSec":number,"visual":string,"onScreenText":string}],"caption":string,"hashtags":string[]}
- scenes 3~5개, 총 15~45초, 세로 9:16 가정
- 과장·허위 할인 금지, 한국어`;
    const user = `매장: ${data.store}
업종: ${data.industry || "미지정"}
키워드: ${data.keyword || "오늘의 메뉴"}
기존 캡션: ${data.caption?.slice(0, 500) || "없음"}`;

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

    if (!res.ok) {
      throw new Error(`AI gateway ${res.status}`);
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "{}";
    let parsed: Partial<VideoStoryboardResult> = {};
    try {
      parsed = JSON.parse(raw) as Partial<VideoStoryboardResult>;
    } catch {
      parsed = {};
    }

    return {
      hook: String(parsed.hook ?? `${data.keyword} 훅`),
      scenes: Array.isArray(parsed.scenes)
        ? parsed.scenes.slice(0, 6).map((s) => ({
            durationSec: Number(s.durationSec) || 5,
            visual: String(s.visual ?? ""),
            onScreenText: String(s.onScreenText ?? ""),
          }))
        : [],
      caption: String(parsed.caption ?? data.caption ?? ""),
      hashtags: Array.isArray(parsed.hashtags)
        ? parsed.hashtags.map(String).filter(Boolean).slice(0, 8)
        : [],
      model,
      note: "스토리보드 생성 완료. 촬영·편집 mp4 URL을 입력한 뒤 하단 발행 바에서 게시하세요. AI 영상 렌더링 API는 추후 연동 예정입니다.",
    };
  });
