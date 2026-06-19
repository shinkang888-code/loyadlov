/**
 * Threads Graph API 발행
 */

type PublishInput = {
  accessToken: string;
  threadsUserId: string;
  caption: string;
  mediaUrl?: string | null;
};

type PublishResult = { ok: true; platformPostId: string } | { ok: false; error: string };

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

export async function publishToThreads(input: PublishInput): Promise<PublishResult> {
  const { accessToken, threadsUserId, caption, mediaUrl } = input;
  const base = `https://graph.threads.net/v1.0/${threadsUserId}`;

  let mediaType = "TEXT";
  const body: Record<string, string> = { text: caption };

  if (mediaUrl?.trim()) {
    mediaType = isVideoUrl(mediaUrl) ? "VIDEO" : "IMAGE";
    body.media_type = mediaType;
    if (mediaType === "VIDEO") {
      body.video_url = mediaUrl.trim();
    } else {
      body.image_url = mediaUrl.trim();
    }
  } else {
    body.media_type = "TEXT";
  }

  const createParams = new URLSearchParams({ ...body, access_token: accessToken });
  const createRes = await fetch(`${base}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: createParams.toString(),
  });

  const createData = (await createRes.json()) as { id?: string; error?: { message?: string } };
  if (!createRes.ok || !createData.id) {
    return {
      ok: false,
      error: createData.error?.message ?? `Threads container 생성 실패 (${createRes.status})`,
    };
  }

  // Meta recommends brief wait before publish
  await new Promise((r) => setTimeout(r, 1500));

  const publishParams = new URLSearchParams({
    creation_id: createData.id,
    access_token: accessToken,
  });
  const publishRes = await fetch(`${base}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: publishParams.toString(),
  });

  const publishData = (await publishRes.json()) as { id?: string; error?: { message?: string } };
  if (!publishRes.ok || !publishData.id) {
    return {
      ok: false,
      error: publishData.error?.message ?? `Threads publish 실패 (${publishRes.status})`,
    };
  }

  return { ok: true, platformPostId: publishData.id };
}
