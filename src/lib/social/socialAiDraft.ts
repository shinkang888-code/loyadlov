import type { SocialPlatform } from "@/lib/social/types";
import { SOCIAL_PLATFORM_LABELS } from "@/lib/social/types";

const PLATFORM_GUIDE: Record<SocialPlatform, string> = {
  instagram: "인스타그램 피드용 150~300자, 이모지 2~3개, 해시태그 5~8개",
  threads: "Threads용 280~500자, 대화체, 해시태그 3~5개",
  youtube: "YouTube Shorts/동영상 설명용: 첫 줄 제목(50자), 본문 200~400자, CTA 포함",
  naver_blog:
    "네이버 블로그용: 첫 줄=제목(50자 이내), 이후=본문(800~1500자). HTML 없이 plain text. SEO 키워드 자연스럽게 포함",
  tiktok: "TikTok 릴스용 100~220자, 트렌디한 톤, 해시태그 3~6개, 세로 영상 URL 필수",
  kakao: "카카오 채널 메시지용 200~400자, 친근한 안내 톤, CTA 포함",
};

export async function generateSocialCaption(input: {
  topic: string;
  platform: SocialPlatform;
  tone?: string;
  keywords?: string[];
  storeName?: string;
  industry?: string;
}): Promise<{
  ok: boolean;
  caption?: string;
  hashtags?: string[];
  keywords?: string[];
  error?: string;
}> {
  const topic = input.topic.trim();
  if (!topic) return { ok: false, error: "주제를 입력하세요." };

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { ok: false, error: "LOVABLE_API_KEY가 설정되지 않았습니다." };

  const platformLabel = SOCIAL_PLATFORM_LABELS[input.platform];
  const keywordHint = input.keywords?.length ? `\n포함 키워드: ${input.keywords.join(", ")}` : "";

  const system = `너는 한국 자영업 매장의 SNS 콘텐츠 카피라이터다.
- 톤앤매너: ${input.tone ?? "친근하고 신뢰감 있는"}
- 출력 형식(JSON only): {"caption":"","hashtags":[],"keywords":[]}
- ${PLATFORM_GUIDE[input.platform]}
- 과장 광고·허위 약속 금지.`;

  const user = `매장명: ${input.storeName ?? "매장"}
업종: ${input.industry ?? "미지정"}
주제: ${topic}
플랫폼: ${platformLabel}${keywordHint}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `AI 생성 실패 (${res.status}): ${text.slice(0, 120)}` };
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content?.trim() ?? "";

  try {
    const parsed = JSON.parse(raw) as {
      caption?: string;
      hashtags?: string[];
      keywords?: string[];
    };
    const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
    let caption = String(parsed.caption ?? "").trim();
    if (hashtags.length && !caption.includes("#")) {
      caption += "\n\n" + hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
    }
    return {
      ok: true,
      caption,
      hashtags,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    };
  } catch {
    return { ok: true, caption: raw, hashtags: [], keywords: [] };
  }
}
