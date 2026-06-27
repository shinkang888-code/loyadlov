// filepath: src/lib/reels.functions.ts
/**
 * 릴스 자동생성 (MoneyPrinterTurbo 워크플로우 이식)
 * - 주제 → AI 스크립트 + 검색어 추출 (Lovable AI gateway / Gemini Flash)
 * - 검색어 → 스톡 영상 조회 (Pexels Videos API)
 * - 결과는 클라이언트에서 미리보기/다운로드/타임라인 구성
 *
 * 원본 MPT는 Python + ffmpeg(MoviePy)로 mp4를 서버에서 합성하지만,
 * Lovable 런타임(Workers)에서는 ffmpeg를 실행할 수 없으므로
 * "스크립트 + 보이스오버 옵션 + 스톡 클립 묶음"까지를 자동화하고
 * 최종 합성은 브라우저 프리뷰 + 에셋 다운로드 형태로 제공한다.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ============ 1) 스크립트 + 검색어 생성 ============ */

const ScriptInput = z.object({
  subject: z.string().trim().min(2).max(200),
  language: z.enum(["ko", "en", "ja", "zh", "es"]).default("ko"),
  paragraphs: z.number().int().min(1).max(6).default(2),
  tone: z.enum(["informative", "casual", "energetic", "calm", "humorous"]).default("informative"),
});

export type ReelsScript = {
  script: string;
  searchTerms: string[];
  estimatedDurationSec: number;
  model: string;
};

export const generateReelsScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ScriptInput.parse(i))
  .handler(async ({ data }): Promise<ReelsScript> => {
    const { resolveLovableApiKey } = await import("@/lib/platformSecrets.server");
    const apiKey = await resolveLovableApiKey();
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing — 설정 탭에서 AI API 키를 입력하세요.");

    const model = "google/gemini-2.5-flash";
    const langName = { ko: "한국어", en: "영어", ja: "일본어", zh: "중국어", es: "스페인어" }[data.language];
    const toneHint = {
      informative: "정보 전달 중심, 신뢰감 있게",
      casual: "친근하고 캐주얼하게",
      energetic: "에너제틱하고 강렬하게",
      calm: "차분하고 잔잔하게",
      humorous: "위트있고 유머러스하게",
    }[data.tone];

    const system = `너는 30~60초 짧은 영상(릴스/숏츠/틱톡)의 스크립트 작가다.
- 주제에 대해 ${data.paragraphs}개 단락(각 2~3문장)의 ${langName} 스크립트 작성
- 톤앤매너: ${toneHint}
- 후크 → 본론 → 마무리 흐름
- 동시에 각 단락에 어울리는 스톡 영상 검색어를 영어로 6~10개 추출 (Pexels 검색 최적화)
- 출력은 JSON only: {"script": string, "search_terms": string[], "estimated_duration_sec": number}`;

    const user = `주제: ${data.subject}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("AI 사용량 한도에 도달했어요. 잠시 후 다시 시도해 주세요.");
    if (res.status === 402) throw new Error("AI 크레딧이 부족합니다. 설정에서 크레딧을 추가해 주세요.");
    if (!res.ok) throw new Error(`AI gateway ${res.status}`);

    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { script?: string; search_terms?: string[]; estimated_duration_sec?: number };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { script: raw };
    }

    return {
      script: parsed.script?.trim() || "",
      searchTerms: (parsed.search_terms ?? []).slice(0, 12).map((s) => String(s).trim()).filter(Boolean),
      estimatedDurationSec: Math.round(parsed.estimated_duration_sec ?? 45),
      model,
    };
  });

/* ============ 2) Pexels 스톡 클립 검색 ============ */

const ClipInput = z.object({
  terms: z.array(z.string().trim().min(1).max(60)).min(1).max(12),
  orientation: z.enum(["portrait", "landscape", "square"]).default("portrait"),
  perTerm: z.number().int().min(1).max(3).default(2),
  minDurationSec: z.number().int().min(2).max(20).default(3),
});

export type StockClip = {
  term: string;
  id: number;
  durationSec: number;
  width: number;
  height: number;
  thumbnail: string;
  videoUrl: string; // mp4 direct link (preview quality)
  hdUrl?: string; // hd link if available
  photographer: string;
  pexelsUrl: string;
};

export const searchReelsStockClips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ClipInput.parse(i))
  .handler(async ({ data }): Promise<{ clips: StockClip[]; provider: "pexels" | "missing-key" }> => {
    const key = process.env.PEXELS_API_KEY?.trim();
    if (!key) return { clips: [], provider: "missing-key" };

    const out: StockClip[] = [];
    for (const term of data.terms) {
      const url = new URL("https://api.pexels.com/videos/search");
      url.searchParams.set("query", term);
      url.searchParams.set("per_page", String(data.perTerm * 2));
      url.searchParams.set("orientation", data.orientation);
      const res = await fetch(url, { headers: { Authorization: key } });
      if (!res.ok) continue;
      const j = (await res.json()) as {
        videos?: Array<{
          id: number;
          duration: number;
          width: number;
          height: number;
          image: string;
          url: string;
          user: { name: string };
          video_files: Array<{ link: string; quality: string; width: number; height: number; file_type: string }>;
        }>;
      };
      const picks = (j.videos ?? [])
        .filter((v) => v.duration >= data.minDurationSec)
        .slice(0, data.perTerm);
      for (const v of picks) {
        const mp4 = v.video_files.filter((f) => f.file_type === "video/mp4");
        const sd = mp4.find((f) => f.quality === "sd") ?? mp4[0];
        const hd = mp4.find((f) => f.quality === "hd");
        if (!sd) continue;
        out.push({
          term,
          id: v.id,
          durationSec: v.duration,
          width: v.width,
          height: v.height,
          thumbnail: v.image,
          videoUrl: sd.link,
          hdUrl: hd?.link,
          photographer: v.user.name,
          pexelsUrl: v.url,
        });
      }
    }
    return { clips: out, provider: "pexels" };
  });

/* ============ 3) 환경 진단 ============ */
export const getReelsProviderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    pexelsConfigured: Boolean(process.env.PEXELS_API_KEY?.trim()),
  }));
