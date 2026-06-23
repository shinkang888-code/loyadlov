// filepath: src/lib/integrations/canva.server.ts
/**
 * Canva Connect API 연동.
 *
 * ⚠️ 중요: Canva는 단순 API 키 방식이 아니라 OAuth 2.0(authorization code + PKCE)
 * 기반이다. "Canva CLI"(@canva/cli)는 Canva '앱' 개발용이라 콘텐츠 자동화에는
 * 직접 쓰지 않는다. 따라서 본 패널에서는 발급받은 액세스 토큰(canvaApiKey)을
 * 저장/검증만 지원하고, 전체 OAuth 인가 플로우는 후속 단계로 둔다.
 *
 * 키 우선순위: app_settings.platform_secrets.canvaApiKey → env CANVA_API_KEY
 */
import { resolveCanvaApiKey } from "@/lib/platformSecrets.server";

const BASE = "https://api.canva.com/rest/v1";

/** 연결 점검 — 저장된 액세스 토큰으로 사용자 조회 */
export async function testCanva(): Promise<{ ok: boolean; message: string }> {
  const token = await resolveCanvaApiKey();
  if (!token) {
    return {
      ok: false,
      message: "토큰 미입력 — Canva는 OAuth 액세스 토큰이 필요합니다.",
    };
  }
  try {
    const res = await fetch(`${BASE}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      return { ok: true, message: "정상 — Canva 액세스 토큰 유효" };
    }
    if (res.status === 401) {
      return {
        ok: false,
        message: "토큰 만료/무효 — OAuth로 액세스 토큰을 재발급하세요.",
      };
    }
    const detail = await res.text().catch(() => "");
    return { ok: false, message: `오류 ${res.status}: ${detail.slice(0, 120)}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "연결 실패" };
  }
}
