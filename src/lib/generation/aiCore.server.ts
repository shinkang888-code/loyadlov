// filepath: src/lib/generation/aiCore.server.ts
/** Shared AI generation logic for sync handlers and async job workers. */

export type TextGenParams = {
  store: string;
  industry?: string;
  tone?: string[];
  keyword?: string;
  channel?: "instagram" | "tiktok" | "naver" | "kakao";
};

export type TextGenResult = {
  body: string;
  hashtags: string[];
  model: string;
};

export async function generateTextContent(data: TextGenParams): Promise<TextGenResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const model = "google/gemini-2.5-flash";
  const tone = data.tone?.length ? data.tone.join(", ") : "친근하고 신뢰감 있는";
  const channel = data.channel ?? "instagram";
  const channelHint =
    channel === "instagram"
      ? "인스타그램 피드 캡션. 2,200자 이내, 줄바꿈 자연스럽게."
      : channel === "tiktok"
        ? "틱톡/릴스 짧은 카피. 8줄 이내."
        : channel === "naver"
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
플랫폼: ${channel} — ${channelHint}`;

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
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 200)}`);
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
}

export type ImageGenResult = {
  dataUrl: string;
  model: string;
};

export async function generateImageContent(prompt: string): Promise<ImageGenResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const model = "openai/gpt-image-2";

  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      quality: "low",
      stream: false,
      n: 1,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Image gateway ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    data?: { b64_json?: string; url?: string }[];
  };
  const item = json.data?.[0];
  if (item?.url) {
    return { dataUrl: item.url, model };
  }
  if (item?.b64_json) {
    return { dataUrl: `data:image/png;base64,${item.b64_json}`, model };
  }

  throw new Error("Image gateway returned empty payload");
}

export function buildImagePrompt(params: {
  store: string;
  industry: string;
  keyword: string;
  styleHint?: string;
}): string {
  const style =
    params.styleHint ??
    "warm moody lighting, cinematic restaurant photography";
  return `${style}. Subject: ${params.store} (${params.industry}). Topic: ${params.keyword}. Korean small-business SNS feed image, 4:5 portrait composition, mouthwatering, high detail, no text overlays.`;
}
