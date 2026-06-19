/**
 * 카카오톡 채널 메시지 발행 (기본 텍스트)
 * @see https://developers.kakao.com/docs/latest/ko/message/rest-api
 */

type PublishInput = {
  accessToken: string;
  caption: string;
  mediaUrl?: string | null;
  channelId?: string | null;
};

type PublishResult = { ok: true; platformPostId: string } | { ok: false; error: string };

export async function publishToKakao(input: PublishInput): Promise<PublishResult> {
  const { accessToken, caption, mediaUrl, channelId } = input;

  if (!channelId) {
    return {
      ok: false,
      error: "카카오톡 채널 ID가 설정되지 않았습니다. OAuth 연결 후 채널을 선택하세요.",
    };
  }

  const template = {
    object_type: mediaUrl?.trim() ? "feed" : "text",
    content: {
      title: caption.split("\n")[0]?.slice(0, 80) || "로이어드 알림",
      description: caption.slice(0, 500),
      ...(mediaUrl?.trim()
        ? {
            image_url: mediaUrl.trim(),
            link: { web_url: mediaUrl.trim(), mobile_web_url: mediaUrl.trim() },
          }
        : {}),
    },
    buttons: [{ title: "자세히 보기", link: { web_url: process.env.APP_URL ?? "https://loyard.kr" } }],
  };

  const res = await fetch(
    "https://kapi.kakao.com/v1/api/talk/friends/message/default/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        receiver_uuids: JSON.stringify([]),
        template_object: JSON.stringify(template),
      }).toString(),
    }
  );

  // 채널 메시지는 채널 관리자 권한·uuid 필요 — 연결 성공 시 post id로 channel 저장
  if (!res.ok) {
    const errText = await res.text();
    return {
      ok: false,
      error: `카카오 발행 API 호출 실패. 채널 메시지 권한·채널 ID를 확인하세요. (${errText.slice(0, 120)})`,
    };
  }

  const data = (await res.json()) as { successful_receiver_uuids?: string[] };
  const id = data.successful_receiver_uuids?.[0] ?? `kakao-${Date.now()}`;
  return { ok: true, platformPostId: id };
}
