/**
 * YouTube Data API v3 발행
 */

import { google } from "googleapis";
import { Readable } from "stream";
import { createGoogleOAuthClient } from "@/lib/googleOAuth.server";
import { getYouTubeRedirectUri } from "@/lib/social/youtubeOAuth";

type PublishInput = {
  accessToken: string;
  refreshToken: string | null;
  origin: string;
  title: string;
  description: string;
  mediaUrl?: string | null;
  scheduledAt?: string | null;
};

type PublishResult = { ok: true; platformPostId: string } | { ok: false; error: string };

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v|avi|mkv)(\?|$)/i.test(url) || url.includes("video");
}

async function downloadVideoBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

export async function publishToYouTube(input: PublishInput): Promise<PublishResult> {
  const { accessToken, refreshToken, origin, title, description, mediaUrl, scheduledAt } = input;

  if (!mediaUrl?.trim() || !isVideoUrl(mediaUrl)) {
    return {
      ok: false,
      error: "YouTube 발행에는 동영상 URL(mp4/mov/webm)이 필요합니다.",
    };
  }

  const videoBuffer = await downloadVideoBuffer(mediaUrl.trim());
  if (!videoBuffer || videoBuffer.length === 0) {
    return { ok: false, error: "동영상 파일을 다운로드하지 못했습니다." };
  }

  const redirectUri = getYouTubeRedirectUri(origin);
  const client = await createGoogleOAuthClient(redirectUri);
  if (!client) {
    return { ok: false, error: "Google OAuth 클라이언트를 초기화하지 못했습니다." };
  }

  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
  });

  const youtube = google.youtube({ version: "v3", auth: client });

  const snippet: { title: string; description: string; categoryId: string } = {
    title: title.slice(0, 100),
    description: description.slice(0, 5000),
    categoryId: "22", // People & Blogs
  };

  const status: { privacyStatus: string; publishAt?: string; selfDeclaredMadeForKids: boolean } = {
    privacyStatus: scheduledAt && new Date(scheduledAt) > new Date() ? "private" : "public",
    selfDeclaredMadeForKids: false,
  };

  if (scheduledAt && new Date(scheduledAt) > new Date()) {
    status.publishAt = new Date(scheduledAt).toISOString();
  }

  try {
    const res = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: { snippet, status },
      media: {
        body: Readable.from(videoBuffer),
      },
    });

    const videoId = res.data.id;
    if (!videoId) {
      return { ok: false, error: "YouTube video ID를 받지 못했습니다." };
    }
    return { ok: true, platformPostId: videoId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "YouTube upload 실패";
    return { ok: false, error: msg };
  }
}
