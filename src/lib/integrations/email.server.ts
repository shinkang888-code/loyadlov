// filepath: src/lib/integrations/email.server.ts
// 이메일 발송 — Resend HTTP API. (서버 전용)
const RESEND_API = "https://api.resend.com/emails";

export type SendEmailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
};

export async function sendEmail(
  input: SendEmailInput
): Promise<{ id: string; from: string }> {
  const { resolveEmailConfig } = await import("@/lib/platformSecrets.server");
  const { apiKey, from } = await resolveEmailConfig();
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY 미설정 — 관리자 콘솔 'API 연동 → 이메일(Resend)'에서 키와 발신 주소를 입력하세요."
    );
  }
  if (!from) {
    throw new Error("EMAIL_FROM(발신 주소) 미설정 — 관리자 콘솔에서 입력하세요.");
  }

  const body: Record<string, unknown> = {
    from,
    to: [input.to],
    subject: input.subject,
  };
  if (input.html) body.html = input.html;
  body.text = input.text ?? stripHtml(input.html ?? "");
  if (input.replyTo) body.reply_to = input.replyTo;

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`이메일 발송 실패 (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { id?: string };
  return { id: data.id ?? "", from };
}

export async function testEmail(): Promise<{ ok: boolean; message: string }> {
  const { resolveEmailConfig } = await import("@/lib/platformSecrets.server");
  const { apiKey, from } = await resolveEmailConfig();
  if (!apiKey) return { ok: false, message: "RESEND_API_KEY가 입력되지 않았습니다." };
  if (!from) return { ok: false, message: "발신 주소(EMAIL_FROM)가 입력되지 않았습니다." };
  // 키 유효성: Resend 도메인 목록 조회
  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.ok) return { ok: true, message: `정상 — 발신: ${from}` };
  return { ok: false, message: `키 검증 실패 (${res.status})` };
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>(?=)/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}
