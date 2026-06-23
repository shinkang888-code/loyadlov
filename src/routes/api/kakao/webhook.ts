// filepath: src/routes/api/kakao/webhook.ts
// 카카오 상담 인입 웹훅.
//
// 지원 형식:
//  1) 카카오 i 오픈빌더 "스킬" 요청 ({ userRequest: { utterance, user:{id} } })
//     → 상담 적재 후 봇 자동응답(설정 시)을 스킬 응답 JSON으로 반환
//  2) 일반 웹훅 ({ user_key|userKey, message|text, name? })
//     → 상담톡/외부 연동/직접 POST 용
//
// 인증: ?store=<store_code> 필수, 토큰은 ?token= 또는 헤더 x-webhook-token.
//       kakao_channel_settings.webhook_token 과 일치해야 한다.
import { createFileRoute } from "@tanstack/react-router";
import {
  getChannelSettings,
  ingestIncomingMessage,
  recordOutgoingMessage,
} from "@/lib/kakao/consult.server";

type SkillRequest = {
  userRequest?: { utterance?: string; user?: { id?: string; properties?: Record<string, unknown> } };
};
type GenericRequest = {
  user_key?: string;
  userKey?: string;
  name?: string;
  message?: string;
  text?: string;
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function skillReply(text: string): Response {
  return jsonRes({
    version: "2.0",
    template: { outputs: [{ simpleText: { text } }] },
  });
}

export const Route = createFileRoute("/api/kakao/webhook")({
  server: {
    handlers: {
      // 헬스체크 / 검증용
      GET: async ({ request }) => {
        const url = new URL(request.url);
        return jsonRes({ ok: true, store: url.searchParams.get("store") ?? null });
      },
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const storeCode = (url.searchParams.get("store") ?? "").trim();
        const token =
          (url.searchParams.get("token") ?? request.headers.get("x-webhook-token") ?? "").trim();

        if (!storeCode) return jsonRes({ error: "missing store" }, 400);

        const settings = await getChannelSettings(storeCode);
        // webhook_token 이 설정돼 있으면 반드시 일치해야 한다.
        if (settings?.webhook_token && settings.webhook_token !== token) {
          return jsonRes({ error: "invalid token" }, 401);
        }

        let body: SkillRequest & GenericRequest;
        try {
          body = (await request.json()) as SkillRequest & GenericRequest;
        } catch {
          return jsonRes({ error: "invalid json" }, 400);
        }

        const isSkill = Boolean(body.userRequest);
        const userKey =
          body.userRequest?.user?.id ?? body.userKey ?? body.user_key ?? "unknown";
        const content = (body.userRequest?.utterance ?? body.message ?? body.text ?? "").trim();
        const name = body.name ?? null;

        if (!content) {
          if (isSkill) return skillReply("메시지를 받지 못했어요. 다시 입력해 주세요.");
          return jsonRes({ error: "empty message" }, 400);
        }

        let consultationId: string;
        try {
          consultationId = await ingestIncomingMessage({
            storeCode,
            userKey,
            name,
            content,
            raw: body as Record<string, unknown>,
          });
        } catch (e) {
          return jsonRes({ error: e instanceof Error ? e.message : "ingest failed" }, 500);
        }

        // 봇 자동응답
        const autoReply = settings?.bot_enabled ? settings.auto_reply?.trim() : "";
        if (autoReply) {
          try {
            await recordOutgoingMessage({
              consultationId,
              storeCode,
              content: autoReply,
              msgType: "auto",
            });
          } catch {
            /* noop */
          }
          if (isSkill) return skillReply(autoReply);
        }

        if (isSkill) {
          // 봇 응답이 없으면 상담원 연결 안내 (오픈빌더에서 상담직원 연결로 폴백 가능)
          return skillReply(
            settings?.bot_enabled
              ? "문의가 접수되었습니다. 상담원이 곧 답변드릴게요."
              : "문의가 접수되었습니다. 상담원이 확인 후 연락드리겠습니다."
          );
        }

        return jsonRes({ ok: true, consultationId });
      },
    },
  },
});
