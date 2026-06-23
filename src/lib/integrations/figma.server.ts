// filepath: src/lib/integrations/figma.server.ts
/**
 * Figma REST API 연동 — 디자인 자산/템플릿 이미지 내보내기
 *
 * 참고: "Figma CLI"(@figma/code-connect)는 디자인→코드 매핑 전용이라 콘텐츠
 * 생성용으로는 부적합. 콘텐츠 SaaS에서 실질적으로 유용한 것은 REST API이며,
 * Personal Access Token(헤더 X-Figma-Token) 한 개로 동작한다.
 *
 * 키 우선순위: app_settings.platform_secrets.figmaToken → env FIGMA_TOKEN
 */
import { resolveFigmaToken } from "@/lib/platformSecrets.server";

const BASE = "https://api.figma.com/v1";

async function figmaFetch(path: string): Promise<Response> {
  const token = await resolveFigmaToken();
  if (!token) {
    throw new Error("FIGMA_TOKEN 미설정 — 관리자 콘솔 'API 연동'에서 토큰을 입력하세요.");
  }
  return fetch(`${BASE}${path}`, { headers: { "X-Figma-Token": token } });
}

/** 연결 점검 — 현재 사용자 정보 */
export async function testFigma(): Promise<{ ok: boolean; message: string }> {
  const token = await resolveFigmaToken();
  if (!token) return { ok: false, message: "토큰이 입력되지 않았습니다." };
  try {
    const res = await figmaFetch("/me");
    if (res.ok) {
      const json = (await res.json()) as { email?: string; handle?: string };
      return { ok: true, message: `정상 — ${json.handle ?? json.email ?? "계정 확인"}` };
    }
    const detail = await res.text().catch(() => "");
    return { ok: false, message: `오류 ${res.status}: ${detail.slice(0, 120)}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "연결 실패" };
  }
}

/**
 * 파일의 특정 노드들을 PNG/SVG/JPG 이미지 URL로 내보낸다.
 * @returns nodeId → 이미지 URL 매핑
 */
export async function exportFigmaImages(
  fileKey: string,
  nodeIds: string[],
  format: "png" | "jpg" | "svg" = "png",
  scale = 2
): Promise<Record<string, string>> {
  const ids = nodeIds.map((id) => encodeURIComponent(id)).join(",");
  const res = await figmaFetch(
    `/images/${encodeURIComponent(fileKey)}?ids=${ids}&format=${format}&scale=${scale}`
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Figma export ${res.status}: ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { images?: Record<string, string>; err?: string };
  if (json.err) throw new Error(`Figma export: ${json.err}`);
  return json.images ?? {};
}
