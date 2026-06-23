// filepath: src/components/AIIntegrationsPanel.tsx
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Plug, Save, Sparkles, XCircle } from "lucide-react";
import { SecretField } from "@/components/setup/SecretField";
import {
  getPlatformSecretsMaskedFn,
  savePlatformSecretsFn,
} from "@/lib/platformSecrets.functions";
import {
  getAiIntegrationStatusFn,
  testAiIntegrationFn,
} from "@/lib/aiIntegrations.functions";
import type { AiIntegrationStatus } from "@/lib/platformSecrets.server";

type TestProvider = "gemini" | "openai" | "higgsfield" | "figma" | "canva";

type TestState = { ok: boolean; message: string } | null;

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="size-4 text-emerald-500" />
  ) : (
    <span className="size-2 rounded-full bg-muted-foreground/40 inline-block" />
  );
}

export function AIIntegrationsPanel({ embedded = false }: { embedded?: boolean }) {
  const getMasked = useServerFn(getPlatformSecretsMaskedFn);
  const saveSecrets = useServerFn(savePlatformSecretsFn);
  const getStatus = useServerFn(getAiIntegrationStatusFn);
  const testFn = useServerFn(testAiIntegrationFn);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [status, setStatus] = useState<AiIntegrationStatus | null>(null);
  const [masked, setMasked] = useState<Record<string, string | null>>({});
  const [testing, setTesting] = useState<TestProvider | null>(null);
  const [tests, setTests] = useState<Record<string, TestState>>({});

  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [higgsfieldApiKey, setHiggsfieldApiKey] = useState("");
  const [higgsfieldSecret, setHiggsfieldSecret] = useState("");
  const [falKey, setFalKey] = useState("");
  const [figmaToken, setFigmaToken] = useState("");
  const [canvaApiKey, setCanvaApiKey] = useState("");
  const [gaPropertyId, setGaPropertyId] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");
  const [emailFrom, setEmailFrom] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const st = await getStatus();
      setCanEdit(st.canEdit);
      setStatus(st.status);
      if (st.canEdit) {
        const m = await getMasked();
        setMasked(m.masked);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "연동 상태 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, [getStatus, getMasked]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveSecrets({
        data: {
          geminiApiKey: geminiApiKey.trim() || undefined,
          openaiApiKey: openaiApiKey.trim() || undefined,
          higgsfieldApiKey: higgsfieldApiKey.trim() || undefined,
          higgsfieldSecret: higgsfieldSecret.trim() || undefined,
          falKey: falKey.trim() || undefined,
          figmaToken: figmaToken.trim() || undefined,
          canvaApiKey: canvaApiKey.trim() || undefined,
          gaPropertyId: gaPropertyId.trim() || undefined,
          resendApiKey: resendApiKey.trim() || undefined,
          emailFrom: emailFrom.trim() || undefined,
        },
      });
      toast.success("API 키 저장 완료 — DB에 암호화 저장되어 환경변수처럼 동작합니다.");
      setGeminiApiKey("");
      setOpenaiApiKey("");
      setHiggsfieldApiKey("");
      setHiggsfieldSecret("");
      setFalKey("");
      setFigmaToken("");
      setCanvaApiKey("");
      setGaPropertyId("");
      setResendApiKey("");
      setEmailFrom("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function runTest(provider: TestProvider) {
    setTesting(provider);
    try {
      const r = await testFn({ data: { provider } });
      setTests((prev) => ({ ...prev, [provider]: { ok: r.ok, message: r.message } }));
      if (r.ok) toast.success(`${provider} 연결 정상`);
      else toast.error(`${provider}: ${r.message}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "테스트 실패";
      setTests((prev) => ({ ...prev, [provider]: { ok: false, message } }));
      toast.error(message);
    } finally {
      setTesting(null);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin inline mr-2" /> 연동 설정 로딩…
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="p-4 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl">
        API 연동 설정은 매장 <strong>소유자(owner)</strong> 또는 <strong>관리자(admin)</strong>만 변경할 수 있습니다.
      </div>
    );
  }

  const TestButton = ({ provider }: { provider: TestProvider }) => {
    const t = tests[provider];
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => void runTest(provider)}
          disabled={testing !== null}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-secondary border border-border text-xs font-medium hover:bg-secondary/70 disabled:opacity-60"
        >
          {testing === provider ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plug className="size-3.5" />
          )}
          연결 테스트
        </button>
        {t && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] ${
              t.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {t.ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
            {t.message}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={embedded ? "space-y-5" : "p-6 space-y-5 overflow-y-auto flex-1 max-w-2xl"}>
      {/* 연동 상태 요약 */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <Sparkles className="size-4 text-primary" /> AI · 미디어 연동 상태
        </h2>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          <li className="flex items-center gap-2"><StatusDot ok={status?.gemini ?? false} /> Google Gemini</li>
          <li className="flex items-center gap-2"><StatusDot ok={status?.openai ?? false} /> OpenAI (ChatGPT)</li>
          <li className="flex items-center gap-2"><StatusDot ok={status?.higgsfield ?? false} /> Higgsfield (이미지·영상)</li>
          <li className="flex items-center gap-2"><StatusDot ok={status?.fal ?? false} /> fal.ai</li>
          <li className="flex items-center gap-2"><StatusDot ok={status?.figma ?? false} /> Figma</li>
          <li className="flex items-center gap-2"><StatusDot ok={status?.canva ?? false} /> Canva</li>
        </ul>
        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          입력한 키는 <strong>app_settings</strong>에 저장되며, 런타임에서는 Vercel 환경변수 →
          DB 순으로 조회됩니다. 즉 이 화면에서 등록/변경하면 별도 재배포 없이 환경변수처럼 즉시 반영됩니다.
        </p>
      </div>

      {/* Gemini */}
      <section className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <h3 className="text-sm font-semibold">Google Gemini</h3>
        <SecretField
          label="GEMINI_API_KEY"
          hint="aistudio.google.com에서 발급. 텍스트 생성에 사용됩니다."
          helpUrl="https://aistudio.google.com/app/apikey"
          value={geminiApiKey}
          onChange={setGeminiApiKey}
          type="password"
          masked={masked.geminiApiKey}
          placeholder="AIza..."
        />
        <TestButton provider="gemini" />
      </section>

      {/* OpenAI */}
      <section className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <h3 className="text-sm font-semibold">OpenAI (ChatGPT)</h3>
        <SecretField
          label="OPENAI_API_KEY"
          hint="platform.openai.com에서 발급. GPT 텍스트 생성에 사용됩니다."
          helpUrl="https://platform.openai.com/api-keys"
          value={openaiApiKey}
          onChange={setOpenaiApiKey}
          type="password"
          masked={masked.openaiApiKey}
          placeholder="sk-..."
        />
        <TestButton provider="openai" />
      </section>

      {/* Higgsfield */}
      <section className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <h3 className="text-sm font-semibold">Higgsfield (이미지 · 영상 생성)</h3>
        <p className="text-[11px] text-muted-foreground">
          platform.higgsfield.ai 대시보드의 API 섹션에서 Key ID와 Secret을 발급받으세요. (공식 server SDK 사용)
        </p>
        <SecretField
          label="HIGGSFIELD_API_KEY (Key ID)"
          value={higgsfieldApiKey}
          onChange={setHiggsfieldApiKey}
          type="password"
          masked={masked.higgsfieldApiKey}
        />
        <SecretField
          label="HIGGSFIELD_SECRET"
          value={higgsfieldSecret}
          onChange={setHiggsfieldSecret}
          type="password"
          masked={masked.higgsfieldSecret}
        />
        <TestButton provider="higgsfield" />
      </section>

      {/* fal.ai */}
      <section className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <h3 className="text-sm font-semibold">fal.ai (선택)</h3>
        <SecretField
          label="FAL_KEY"
          hint="fal.ai 서버리스 모델 게이트웨이 키. (후속 미디어 프로바이더용)"
          helpUrl="https://fal.ai/dashboard/keys"
          value={falKey}
          onChange={setFalKey}
          type="password"
          masked={masked.falKey}
        />
      </section>

      {/* Figma */}
      <section className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <h3 className="text-sm font-semibold">Figma (디자인 자산 내보내기)</h3>
        <SecretField
          label="FIGMA_TOKEN (Personal Access Token)"
          hint="Figma 설정 > Personal access tokens에서 발급. 파일 노드를 이미지로 내보냅니다."
          helpUrl="https://www.figma.com/developers/api#access-tokens"
          value={figmaToken}
          onChange={setFigmaToken}
          type="password"
          masked={masked.figmaToken}
          placeholder="figd_..."
        />
        <TestButton provider="figma" />
      </section>

      {/* Canva */}
      <section className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <h3 className="text-sm font-semibold">Canva (Connect API)</h3>
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          Canva는 OAuth 2.0 기반입니다. 발급받은 액세스 토큰을 저장/검증만 지원하며, 전체 인가 플로우는 후속
          단계입니다.
        </p>
        <SecretField
          label="CANVA_API_KEY (Access Token)"
          helpUrl="https://www.canva.dev/docs/connect/"
          value={canvaApiKey}
          onChange={setCanvaApiKey}
          type="password"
          masked={masked.canvaApiKey}
        />
        <TestButton provider="canva" />
      </section>

      {/* Google Analytics */}
      <section className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <h3 className="text-sm font-semibold">Google Analytics (성과 리포트 방문자수)</h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          GA4 <strong>속성 ID</strong>(숫자, 예: 123456789)를 입력하세요. 인증은 Google Drive와 동일한
          서비스 계정을 재사용하므로, 해당 <strong>서비스 계정 이메일을 GA4 속성의 뷰어</strong>로 추가해야 합니다.
        </p>
        <SecretField
          label="GA_PROPERTY_ID (GA4 속성 ID)"
          hint="GA 관리 > 속성 설정 상단의 '속성 ID' 숫자를 입력하세요."
          helpUrl="https://developers.google.com/analytics/devguides/reporting/data/v1/property-id"
          value={gaPropertyId}
          onChange={setGaPropertyId}
          type="text"
          masked={masked.gaPropertyId}
          placeholder="123456789"
        />
      </section>

      {/* 이메일 (Resend) */}
      <section className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <h3 className="text-sm font-semibold">이메일 발송 (회원 관리 · Resend)</h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          회원에게 이메일을 보내려면 <strong>Resend</strong> API Key와 발신 주소가 필요합니다. 발신 도메인은
          Resend에서 인증(SPF/DKIM)되어 있어야 합니다.
        </p>
        <SecretField
          label="RESEND_API_KEY"
          hint="resend.com → API Keys 에서 발급"
          helpUrl="https://resend.com/api-keys"
          value={resendApiKey}
          onChange={setResendApiKey}
          type="password"
          masked={masked.resendApiKey}
          placeholder="re_..."
        />
        <SecretField
          label="EMAIL_FROM (발신 주소)"
          hint="예: 상담센터 <hello@yourdomain.com>"
          value={emailFrom}
          onChange={setEmailFrom}
          type="text"
          masked={masked.emailFrom}
          placeholder="브랜드명 <noreply@yourdomain.com>"
        />
      </section>

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-brand text-primary-foreground text-sm font-semibold disabled:opacity-60"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        모든 API 키 저장 (등록/변경)
      </button>
    </div>
  );
}
