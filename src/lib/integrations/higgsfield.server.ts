// filepath: src/lib/integrations/higgsfield.server.ts
/**
 * Higgsfield 미디어 생성 연동 — 공식 SDK(@higgsfield/client) 래퍼.
 *
 * 공식 생성 엔드포인트(POST /jobs/*)는 DataDome 봇 차단이 걸려 수제 REST 호출은
 * 403이 난다. 공식 server-side SDK는 KEY_ID:KEY_SECRET 인증과 obfuscated
 * User-Agent로 이를 우회하므로 반드시 SDK를 사용한다. (server-only 모듈)
 *
 * 키 우선순위: app_settings.platform_secrets.higgsfield{ApiKey,Secret}
 *            → env HIGGSFIELD_API_KEY / HIGGSFIELD_SECRET
 */
import { HiggsfieldClient } from "@higgsfield/client";
import { resolveHiggsfieldCredentials } from "@/lib/platformSecrets.server";

const BASE_URL = "https://platform.higgsfield.ai";

async function getClient(): Promise<HiggsfieldClient> {
  const { apiKey, secret } = await resolveHiggsfieldCredentials();
  if (!apiKey || !secret) {
    throw new Error(
      "Higgsfield 자격증명 미설정 — 관리자 콘솔 'API 연동'에서 API Key/Secret을 입력하세요."
    );
  }
  return new HiggsfieldClient({
    apiKey,
    apiSecret: secret,
    baseURL: BASE_URL,
    maxPollTime: 280_000,
    pollInterval: 3_000,
  });
}

export type HiggsfieldMediaResult = {
  jobSetId: string;
  urls: string[];
  status: string;
};

function collectUrls(jobSet: {
  id: string;
  jobs: { status: string; results?: { raw?: { url?: string }; min?: { url?: string } } | null }[];
}): HiggsfieldMediaResult {
  const urls: string[] = [];
  for (const job of jobSet.jobs) {
    const url = job.results?.raw?.url || job.results?.min?.url;
    if (url) urls.push(url);
  }
  return { jobSetId: jobSet.id, urls, status: urls.length ? "completed" : "empty" };
}

/** 텍스트→이미지 (Soul) */
export async function generateHiggsfieldImage(params: {
  prompt: string;
  size?: string;
  quality?: string;
  batchSize?: number;
}): Promise<HiggsfieldMediaResult> {
  const client = await getClient();
  try {
    const jobSet = await client.generate(
      "/v1/text2image/soul",
      {
        prompt: params.prompt,
        width_and_height: params.size || "1536x1536",
        quality: params.quality || "1080p",
        batch_size: params.batchSize || 1,
      },
      { withPolling: true }
    );
    return collectUrls(jobSet);
  } finally {
    client.close();
  }
}

/** 텍스트/이미지→영상 (DoP) */
export async function generateHiggsfieldVideo(params: {
  prompt: string;
  imageUrl?: string;
  model?: string;
}): Promise<HiggsfieldMediaResult> {
  const client = await getClient();
  try {
    const generateParams: Record<string, unknown> = {
      prompt: params.prompt,
      model: params.model || "dop-turbo",
    };
    if (params.imageUrl) {
      generateParams.input_image = { type: "image_url", image_url: params.imageUrl };
    }
    const jobSet = await client.generate("/v1/image2video/dop", generateParams, {
      withPolling: true,
    });
    return collectUrls(jobSet);
  } finally {
    client.close();
  }
}

/** 연결 점검 — Soul 스타일 목록(GET) 조회로 자격증명 검증 */
export async function testHiggsfield(): Promise<{ ok: boolean; message: string }> {
  const { apiKey, secret } = await resolveHiggsfieldCredentials();
  if (!apiKey || !secret) {
    return { ok: false, message: "API Key/Secret이 입력되지 않았습니다." };
  }
  try {
    const client = await getClient();
    try {
      const styles = await client.getSoulStyles();
      return { ok: true, message: `정상 — 스타일 ${styles.length}개 사용 가능` };
    } finally {
      client.close();
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "연결 실패" };
  }
}
