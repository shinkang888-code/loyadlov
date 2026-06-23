// filepath: src/components/KakaoSettingsDialog.tsx
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, Copy, RefreshCw, Loader2, Save, Bot, Link2, Webhook } from "lucide-react";
import { saveKakaoSettingsFn, type KakaoSettings } from "@/lib/kakaoConsult.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeCode?: string;
  settings: KakaoSettings | null;
  onSaved: (s: KakaoSettings) => void;
};

export function KakaoSettingsDialog({ open, onOpenChange, storeCode, settings, onSaved }: Props) {
  const saveFn = useServerFn(saveKakaoSettingsFn);
  const [saving, setSaving] = useState(false);

  const [channelPublicId, setChannelPublicId] = useState("");
  const [channelChatUrl, setChannelChatUrl] = useState("");
  const [chatbotManageUrl, setChatbotManageUrl] = useState("");
  const [botEnabled, setBotEnabled] = useState(false);
  const [autoReply, setAutoReply] = useState("");
  const [restApiKey, setRestApiKey] = useState("");

  useEffect(() => {
    if (open && settings) {
      setChannelPublicId(settings.channelPublicId);
      setChannelChatUrl(settings.channelChatUrl);
      setChatbotManageUrl(settings.chatbotManageUrl);
      setBotEnabled(settings.botEnabled);
      setAutoReply(settings.autoReply);
      setRestApiKey("");
    }
  }, [open, settings]);

  if (!open) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl =
    settings && storeCode
      ? `${origin}/api/kakao/webhook?store=${encodeURIComponent(storeCode)}&token=${settings.webhookToken}`
      : "";

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("복사되었습니다.");
  };

  const save = async (regenerateToken = false) => {
    setSaving(true);
    try {
      const res = await saveFn({
        data: {
          storeCode,
          channelPublicId,
          channelChatUrl,
          chatbotManageUrl,
          botEnabled,
          autoReply,
          restApiKey: restApiKey.trim() || undefined,
          regenerateToken,
        },
      });
      onSaved(res.settings);
      toast.success(regenerateToken ? "웹훅 토큰을 재발급했습니다." : "설정이 저장되었습니다.");
      if (!regenerateToken) onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => onOpenChange(false)}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <h3 className="font-display font-bold text-base">카카오 상담채널 설정</h3>
          <button onClick={() => onOpenChange(false)} className="size-8 grid place-items-center rounded-lg hover:bg-secondary">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* 채널 연결 */}
          <section className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Link2 className="size-3.5" /> 채널 연결
            </h4>
            <Field label="채널 Public ID" hint="예: _ZeUTxl (채널 관리자센터 > 채널정보)">
              <input
                value={channelPublicId}
                onChange={(e) => setChannelPublicId(e.target.value)}
                placeholder="_ZeUTxl"
                className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
            <Field label="상담 대화창 URL" hint="‘채팅방 열기/카카오 대화’ 버튼이 새창으로 여는 주소 (채널 관리자센터 채팅 URL)">
              <input
                value={channelChatUrl}
                onChange={(e) => setChannelChatUrl(e.target.value)}
                placeholder="https://center-pf.kakao.com/_xxxx/chats"
                className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
          </section>

          {/* 챗봇 */}
          <section className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Bot className="size-3.5" /> 챗봇
            </h4>
            <Field label="챗봇 관리 URL" hint="‘챗봇 관리’ 버튼이 여는 카카오 i 오픈빌더 주소">
              <input
                value={chatbotManageUrl}
                onChange={(e) => setChatbotManageUrl(e.target.value)}
                placeholder="https://i.kakao.com/login"
                className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={botEnabled}
                onChange={(e) => setBotEnabled(e.target.checked)}
                className="size-4 accent-[#FEE500]"
              />
              자동응답 봇 사용 (웹훅으로 들어온 메시지에 기본 답변)
            </label>
            <Field label="자동응답 메시지" hint="봇 사용 시 첫 응답으로 보낼 안내 문구">
              <textarea
                value={autoReply}
                onChange={(e) => setAutoReply(e.target.value)}
                rows={2}
                placeholder="안녕하세요! 문의 주셔서 감사합니다. 상담원이 곧 답변드릴게요."
                className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </Field>
          </section>

          {/* 웹훅 */}
          <section className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Webhook className="size-3.5" /> 웹훅 (인입 연결)
            </h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              카카오 i 오픈빌더 <strong>스킬 서버 URL</strong> 또는 상담톡/외부 연동의 콜백 주소로 아래 URL을 등록하면,
              들어오는 메시지가 이 대시보드에 실시간으로 쌓입니다.
            </p>
            <div className="flex items-center gap-2">
              <input readOnly value={webhookUrl} className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono text-[11px]" />
              <button
                onClick={() => copy(webhookUrl)}
                className="size-9 shrink-0 grid place-items-center rounded-lg border border-border hover:bg-secondary"
                title="복사"
              >
                <Copy className="size-4" />
              </button>
              <button
                onClick={() => void save(true)}
                disabled={saving}
                className="size-9 shrink-0 grid place-items-center rounded-lg border border-border hover:bg-secondary"
                title="토큰 재발급"
              >
                <RefreshCw className={`size-4 ${saving ? "animate-spin" : ""}`} />
              </button>
            </div>
            <Field label="발송용 REST API Key (선택)" hint="저장됨 여부만 표시됩니다. 비워두면 변경 안 함.">
              <input
                type="password"
                value={restApiKey}
                onChange={(e) => setRestApiKey(e.target.value)}
                placeholder={settings?.hasRestKey ? "저장됨 ••••" : "(선택) 발송 자동화용"}
                className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
          </section>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
          <button onClick={() => onOpenChange(false)} className="h-10 px-4 rounded-xl border border-border text-sm">
            취소
          </button>
          <button
            onClick={() => void save(false)}
            disabled={saving}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-brand text-primary-foreground text-sm font-semibold disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground">{label}</label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}
