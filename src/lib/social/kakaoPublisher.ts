/**
 * 카카오톡 채널 콘텐츠 발행
 * - 1차: talk_message API로 채널 관리자 "나와의 채팅"에 피드 템플릿 전송 (OAuth talk_message 스코프)
 * - 채널 구독자 대량 발송(친구톡)은 Kakao BizMessage 연동 필요 (Phase 7)
 * @see https://developers.kakao.com/docs/latest/ko/kakaotalk-message/rest-api
 */

import { resolveKakaoChannelPublicId } from "@/lib/social/kakaoOAuthSettings";

type PublishInput = {
  accessToken: string;
  caption: string;
  mediaUrl?: string | null;
  channelId?: string | null;
};

type PublishResult = { ok: true; platformPostId: string } | { ok: false; error: string };

function buildFeedTemplate(caption: string, mediaUrl: string | null | undefined, linkUrl: string) {
  const title = caption.split("\n")[0]?.trim().slice(0, 80) || "로이어드 알림";
  const description = caption.trim().slice(0, 500);
  const hasMedia = Boolean(mediaUrl?.trim());

  return {
    object_type: hasMedia ? "feed" : "text",
    content: {
      title,
      description,
      ...(hasMedia
        ? {
            image_url: mediaUrl!.trim(),
            image_width: 800,
            image_height: 800,
          }
        : {}),
      link: {
        web_url: linkUrl,
        mobile_web_url: linkUrl,
      },
    },
    buttons: [{ title: "채널 보기", link: { web_url: linkUrl, mobile_web_url: linkUrl } }],
  };
}

function channelProfileUrl(channelPublicId: string): string {
  const id = channelPublicId.trim().replace(/^_/, "");
  return `https://pf.kakao.com/_${id}`;
}

export async function publishToKakao(input: PublishInput): Promise<PublishResult> {
  const { accessToken, caption, mediaUrl } = input;
  const channelPublicId =
    input.channelId?.trim() || (await resolveKakaoChannelPublicId()) || null;

  const { resolveAppUrl } = await import("@/lib/platformSecrets.server");
  const appUrl = await resolveAppUrl("https://loyadbeta.vercel.app");
  const linkUrl = channelPublicId ? channelProfileUrl(channelPublicId) : appUrl;

  if (!channelPublicId) {
    return {
      ok: false,
      error:
        "카카오톡 채널 Public ID가 설정되지 않았습니다. 설정 탭에서 KAKAO_CHANNEL_PUBLIC_ID(예: _ZeUTxl)를 저장하세요.",
    };
  }

  const template = buildFeedTemplate(caption, mediaUrl, linkUrl);

  const res = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({
      template_object: JSON.stringify(template),
    }).toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    const hint =
      errText.includes("NotAuthorized") || errText.includes("scope")
        ? " 카카오 앱에 talk_message 동의항목을 추가하고 OAuth를 다시 연결하세요."
        : "";
    return {
      ok: false,
      error: `카카오 발행 실패 (${res.status}).${hint} ${errText.slice(0, 160)}`,
    };
  }

  const data = (await res.json()) as { result_code?: number };
  if (data.result_code !== 0 && data.result_code !== undefined) {
    return { ok: false, error: `카카오 API result_code=${data.result_code}` };
  }

  const postId = `kakao-memo-${channelPublicId}-${Date.now()}`;
  return { ok: true, platformPostId: postId };
}
