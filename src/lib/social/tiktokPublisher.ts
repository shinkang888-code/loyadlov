/**
 * TikTok Content Posting API
 * @see https://developers.tiktok.com/doc/content-posting-api-get-started/
 */

type PublishInput = {
  accessToken: string;
  openId: string;
  caption: string;
  mediaUrl?: string | null;
};

type PublishResult = { ok: true; platformPostId: string } | { ok: false; error: string };

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

export async function publishToTikTok(input: PublishInput): Promise<PublishResult> {
  const { accessToken, caption, mediaUrl } = input;

  if (!mediaUrl?.trim() || !isVideoUrl(mediaUrl)) {
    return {
      ok: false,
      error: "TikTok 발행에는 공개 접근 가능한 동영상 URL(mp4/mov/webm)이 필요합니다.",
    };
  }

  const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: caption.slice(0, 150),
        privacy_level: "PUBLIC_TO_EVERYONE",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: mediaUrl.trim(),
      },
    }),
  });

  const initData = (await initRes.json()) as {
    data?: { publish_id?: string };
    error?: { message?: string; code?: string };
  };

  if (!initRes.ok || !initData.data?.publish_id) {
    return {
      ok: false,
      error: initData.error?.message ?? `TikTok publish init 실패 (${initRes.status})`,
    };
  }

  return { ok: true, platformPostId: initData.data.publish_id };
}
