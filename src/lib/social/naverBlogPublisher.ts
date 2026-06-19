/**
 * 네이버 블로그 writePost.json 발행
 */

import { buildNaverApiHeaders } from "@/lib/social/naverOAuth";

export type NaverBlogPublishOptions = {
  categoryNo?: number;
  openType?: "all" | "closed" | "neighbor" | "agreedNeighbor";
};

type PublishInput = {
  accessToken: string;
  title: string;
  contents: string;
  mediaUrl?: string | null;
  options?: NaverBlogPublishOptions;
};

type PublishResult =
  | { ok: true; platformPostId: string; postUrl?: string }
  | { ok: false; error: string };

function splitTitleBody(caption: string): { title: string; body: string } {
  const lines = caption.trim().split("\n");
  const title = (lines[0] ?? "Loyad 블로그 포스트").slice(0, 200);
  const body = lines.slice(1).join("\n").trim() || caption.trim();
  return { title, body };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toHtmlBody(body: string, mediaUrl?: string | null): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const img =
    mediaUrl?.trim() && !/\.(mp4|mov|webm)/i.test(mediaUrl)
      ? `<p><img src="${escapeHtml(mediaUrl.trim())}" alt="" /></p>`
      : "";
  return paragraphs + img;
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; filename: string } | null> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("gif") ? "gif" : "jpg";
    return { buffer: buf, filename: `image.${ext}` };
  } catch {
    return null;
  }
}

export async function publishToNaverBlog(input: PublishInput): Promise<PublishResult> {
  const headers = await buildNaverApiHeaders(input.accessToken);
  if (!headers) {
    return { ok: false, error: "네이버 API 인증 헤더를 만들 수 없습니다." };
  }

  const title = input.title.slice(0, 200);
  const contents = toHtmlBody(input.contents, input.mediaUrl);
  const opts = input.options ?? {};

  const imageFile =
    input.mediaUrl?.trim() && !/\.(mp4|mov|webm)/i.test(input.mediaUrl)
      ? await downloadImage(input.mediaUrl.trim())
      : null;

  let res: Response;

  if (imageFile) {
    const form = new FormData();
    form.append("title", title);
    form.append("contents", contents);
    if (opts.categoryNo != null) form.append("categoryNo", String(opts.categoryNo));
    form.append("options.openType", opts.openType ?? "all");
    form.append("options.allowComment", "true");
    form.append("options.allowSearch", "true");
    const blob = new Blob([new Uint8Array(imageFile.buffer)], { type: "application/octet-stream" });
    form.append("image", blob, imageFile.filename);

    res = await fetch("https://openapi.naver.com/blog/writePost.json", {
      method: "POST",
      headers: {
        Authorization: headers.Authorization,
        "X-Naver-Client-Id": headers["X-Naver-Client-Id"],
        "X-Naver-Client-Secret": headers["X-Naver-Client-Secret"],
      },
      body: form,
    });
  } else {
    const params = new URLSearchParams({
      title,
      contents,
      "options.openType": opts.openType ?? "all",
      "options.allowComment": "true",
      "options.allowSearch": "true",
    });
    if (opts.categoryNo != null) params.set("categoryNo", String(opts.categoryNo));

    res = await fetch("https://openapi.naver.com/blog/writePost.json", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  }

  const data = (await res.json()) as {
    message?: {
      result?: { postUrl?: string; logNo?: number | string };
      status?: string;
      error?: { code?: string; message?: string };
    };
  };

  if (!res.ok) {
    const errMsg =
      data.message?.error?.message ??
      data.message?.status ??
      `네이버 블로그 발행 실패 (${res.status})`;
    return { ok: false, error: errMsg };
  }

  const logNo = data.message?.result?.logNo;
  const postUrl = data.message?.result?.postUrl;
  if (logNo == null && !postUrl) {
    return { ok: false, error: "발행 응답에 post ID가 없습니다." };
  }

  return {
    ok: true,
    platformPostId: String(logNo ?? postUrl),
    postUrl: postUrl ?? undefined,
  };
}

/** caption 전체를 title+body로 분리해 발행 */
export async function publishNaverBlogFromCaption(
  accessToken: string,
  caption: string,
  mediaUrl?: string | null,
  options?: NaverBlogPublishOptions
): Promise<PublishResult> {
  const { title, body } = splitTitleBody(caption);
  return publishToNaverBlog({
    accessToken,
    title,
    contents: body,
    mediaUrl,
    options,
  });
}
