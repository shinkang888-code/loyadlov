/**
 * Instagram Graph API 발행
 */

type PublishInput = {
  pageAccessToken: string;
  instagramBusinessAccountId: string;
  caption: string;
  mediaUrl?: string | null;
};

type PublishResult = { ok: true; platformPostId: string } | { ok: false; error: string };

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

export async function publishToInstagram(input: PublishInput): Promise<PublishResult> {
  const { pageAccessToken, instagramBusinessAccountId, caption, mediaUrl } = input;
  const igId = instagramBusinessAccountId;

  if (!mediaUrl?.trim()) {
    return { ok: false, error: "Instagram 게시에는 이미지 또는 동영상 URL이 필요합니다." };
  }

  const isVideo = isVideoUrl(mediaUrl);
  const createBody: Record<string, string> = {
    caption,
    access_token: pageAccessToken,
  };

  if (isVideo) {
    createBody.media_type = "REELS";
    createBody.video_url = mediaUrl.trim();
  } else {
    createBody.image_url = mediaUrl.trim();
  }

  const createParams = new URLSearchParams(createBody);
  const createRes = await fetch(
    `https://graph.facebook.com/v21.0/${igId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: createParams.toString(),
    }
  );

  const createData = (await createRes.json()) as { id?: string; error?: { message?: string } };
  if (!createRes.ok || !createData.id) {
    return {
      ok: false,
      error: createData.error?.message ?? `Instagram media container 실패 (${createRes.status})`,
    };
  }

  // Video processing may take longer
  const waitMs = isVideo ? 8000 : 2000;
  await new Promise((r) => setTimeout(r, waitMs));

  const publishParams = new URLSearchParams({
    creation_id: createData.id,
    access_token: pageAccessToken,
  });
  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: publishParams.toString(),
    }
  );

  const publishData = (await publishRes.json()) as { id?: string; error?: { message?: string } };
  if (!publishRes.ok || !publishData.id) {
    return {
      ok: false,
      error: publishData.error?.message ?? `Instagram publish 실패 (${publishRes.status})`,
    };
  }

  return { ok: true, platformPostId: publishData.id };
}
