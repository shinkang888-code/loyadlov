// filepath: src/lib/integrations/googleAnalytics.server.ts
/**
 * Google Analytics (GA4) Data API 연동 — 성과 리포트(방문자수 등).
 *
 * 인증: Google Drive와 동일한 서비스 계정(googleClientEmail/googlePrivateKey)을
 * 재사용해 analytics.readonly 스코프 액세스 토큰을 발급한다.
 * ⚠️ 해당 서비스 계정 이메일을 GA4 속성의 "뷰어"로 추가해야 한다.
 *
 * 속성 ID: app_settings.platform_secrets.gaPropertyId → env GA_PROPERTY_ID
 * (server-only 모듈 — Web Crypto 사용)
 */
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GA_DATA_API = "https://analyticsdata.googleapis.com/v1beta";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

function b64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else if (input instanceof Uint8Array) bytes = input;
  else bytes = new Uint8Array(input);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(clean);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

let cachedToken: { token: string; exp: number } | null = null;

async function getAnalyticsAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const { resolveGoogleDriveCredentials } = await import("@/lib/platformSecrets.server");
  const creds = await resolveGoogleDriveCredentials();
  if (!creds.clientEmail || !creds.privateKey) {
    throw new Error(
      "Google 서비스 계정 미설정 — 관리자 콘솔 설정에서 서비스 계정 이메일/Private Key를 입력하고, 해당 계정을 GA4 속성 뷰어로 추가하세요."
    );
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claim = { iss: creds.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(creds.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${b64url(sig)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google 토큰 교환 실패: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, exp: now + data.expires_in };
  return data.access_token;
}

type GaRow = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };

async function runReport(
  propertyId: string,
  token: string,
  body: Record<string, unknown>
): Promise<GaRow[]> {
  const res = await fetch(`${GA_DATA_API}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`GA4 runReport ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { rows?: GaRow[] };
  return json.rows ?? [];
}

export type GaReport = {
  propertyId: string;
  range: string;
  totals: {
    activeUsers: number;
    newUsers: number;
    sessions: number;
    screenPageViews: number;
    avgSessionDurationSec: number;
    bounceRate: number; // 0..1
  };
  daily: { date: string; activeUsers: number; screenPageViews: number }[];
  topPages: { title: string; views: number }[];
  channels: { channel: string; sessions: number }[];
};

const RANGE_DAYS: Record<string, string> = {
  "7d": "7daysAgo",
  "28d": "28daysAgo",
  "90d": "90daysAgo",
};

function num(v?: string): number {
  const n = Number(v ?? "0");
  return Number.isFinite(n) ? n : 0;
}

function fmtDate(yyyymmdd: string): string {
  if (yyyymmdd.length === 8) {
    return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
  }
  return yyyymmdd;
}

export async function getGaReport(opts: {
  propertyId?: string;
  range?: "7d" | "28d" | "90d";
}): Promise<GaReport> {
  const { resolveGaPropertyId } = await import("@/lib/platformSecrets.server");
  const propertyId = (opts.propertyId?.replace(/^properties\//, "").trim()) || (await resolveGaPropertyId());
  if (!propertyId) {
    throw new Error("GA4 속성 ID 미설정 — 관리자 콘솔 'API 연동'에서 GA_PROPERTY_ID를 입력하세요.");
  }
  const range = opts.range ?? "28d";
  const startDate = RANGE_DAYS[range] ?? "28daysAgo";
  const dateRanges = [{ startDate, endDate: "today" }];
  const token = await getAnalyticsAccessToken();

  const [totalRows, dailyRows, pageRows, channelRows] = await Promise.all([
    runReport(propertyId, token, {
      dateRanges,
      metrics: [
        { name: "activeUsers" },
        { name: "newUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
      ],
    }),
    runReport(propertyId, token, {
      dateRanges,
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
    runReport(propertyId, token, {
      dateRanges,
      dimensions: [{ name: "pageTitle" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 5,
    }),
    runReport(propertyId, token, {
      dateRanges,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 6,
    }),
  ]);

  const t = totalRows[0]?.metricValues ?? [];
  return {
    propertyId,
    range,
    totals: {
      activeUsers: num(t[0]?.value),
      newUsers: num(t[1]?.value),
      sessions: num(t[2]?.value),
      screenPageViews: num(t[3]?.value),
      avgSessionDurationSec: Math.round(num(t[4]?.value)),
      bounceRate: num(t[5]?.value),
    },
    daily: dailyRows.map((r) => ({
      date: fmtDate(r.dimensionValues?.[0]?.value ?? ""),
      activeUsers: num(r.metricValues?.[0]?.value),
      screenPageViews: num(r.metricValues?.[1]?.value),
    })),
    topPages: pageRows.map((r) => ({
      title: r.dimensionValues?.[0]?.value ?? "(제목 없음)",
      views: num(r.metricValues?.[0]?.value),
    })),
    channels: channelRows.map((r) => ({
      channel: r.dimensionValues?.[0]?.value ?? "기타",
      sessions: num(r.metricValues?.[0]?.value),
    })),
  };
}

export async function testGoogleAnalytics(): Promise<{ ok: boolean; message: string }> {
  const { resolveGaPropertyId } = await import("@/lib/platformSecrets.server");
  const propertyId = await resolveGaPropertyId();
  if (!propertyId) return { ok: false, message: "GA4 속성 ID가 입력되지 않았습니다." };
  try {
    const report = await getGaReport({ range: "7d" });
    return { ok: true, message: `정상 — 최근 7일 방문자 ${report.totals.activeUsers.toLocaleString()}명` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "연결 실패" };
  }
}
