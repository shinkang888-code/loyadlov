// filepath: src/components/PlatformSetupWizard.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  HardDrive,
  KeyRound,
  Loader2,
  Rocket,
  Save,
  Share2,
  Shield,
  Sparkles,
} from "lucide-react";
import { SecretField } from "@/components/setup/SecretField";
import { OAuthSettingsPanel } from "@/components/OAuthSettingsPanel";
import {
  generatePlatformTokenFn,
  getPlatformSecretsMaskedFn,
  getPlatformSetupStatusFn,
  savePlatformSecretsFn,
} from "@/lib/platformSecrets.functions";
import { createStripeCheckoutFn, getSubscriptionFn } from "@/lib/billing.functions";
import type { PlatformSetupStatus } from "@/lib/platformSecrets.server";

const STEPS = [
  { id: "intro", title: "시작하기", Icon: Rocket },
  { id: "ai", title: "AI & 앱", Icon: Bot },
  { id: "security", title: "보안", Icon: Shield },
  { id: "oauth", title: "소셜 OAuth", Icon: Share2 },
  { id: "extras", title: "Drive & 결제", Icon: CreditCard },
  { id: "done", title: "완료", Icon: CheckCircle2 },
] as const;

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
        ok
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
          : "bg-secondary border-border text-muted-foreground"
      }`}
    >
      {ok ? <CheckCircle2 className="size-3" /> : <span className="size-1.5 rounded-full bg-muted-foreground/40" />}
      {label}
    </span>
  );
}

export function PlatformSetupWizard({ storeCode }: { storeCode?: string }) {
  const getStatus = useServerFn(getPlatformSetupStatusFn);
  const getMasked = useServerFn(getPlatformSecretsMaskedFn);
  const saveSecrets = useServerFn(savePlatformSecretsFn);
  const genToken = useServerFn(generatePlatformTokenFn);
  const checkout = useServerFn(createStripeCheckoutFn);
  const getSub = useServerFn(getSubscriptionFn);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [percent, setPercent] = useState(0);
  const [status, setStatus] = useState<PlatformSetupStatus | null>(null);
  const [masked, setMasked] = useState<Record<string, string | null>>({});

  const [lovableApiKey, setLovableApiKey] = useState("");
  const [appUrl, setAppUrl] = useState("https://loyadbeta.vercel.app");
  const [cronSecret, setCronSecret] = useState("");
  const [socialTokenEncryptionKey, setSocialTokenEncryptionKey] = useState("");
  const [googleClientEmail, setGoogleClientEmail] = useState("");
  const [googlePrivateKey, setGooglePrivateKey] = useState("");
  const [googleDriveRootFolderId, setGoogleDriveRootFolderId] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");
  const [stripePriceStandard, setStripePriceStandard] = useState("");
  const [stripePricePremium, setStripePricePremium] = useState("");
  const [runwayApiKey, setRunwayApiKey] = useState("");
  const [billingLoading, setBillingLoading] = useState<"standard" | "premium" | null>(null);
  const [subscription, setSubscription] = useState<{ plan?: string; status?: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [st, sub] = await Promise.all([
        getStatus(),
        storeCode ? getSub({ data: { storeCode } }) : getSub({ data: {} }),
      ]);
      setCanEdit(st.canEdit);
      setPercent(st.percentComplete);
      setStatus(st.status);
      setSubscription(sub.subscription);

      if (st.canEdit) {
        const m = await getMasked();
        setMasked(m.masked);
        if (m.appUrl) setAppUrl(m.appUrl);
        if (m.googleClientEmail) setGoogleClientEmail(m.googleClientEmail);
        if (m.googleDriveRootFolderId) setGoogleDriveRootFolderId(m.googleDriveRootFolderId);
        if (m.stripePublishableKey) setStripePublishableKey(m.stripePublishableKey);
        if (m.stripePriceStandard) setStripePriceStandard(m.stripePriceStandard);
        if (m.stripePricePremium) setStripePricePremium(m.stripePricePremium);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "설정 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, [getStatus, getMasked, getSub, storeCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const checklist = useMemo(() => {
    if (!status) return [];
    return [
      { ok: status.lovableApiKey, label: "AI API (Lovable)" },
      { ok: status.appUrl, label: "앱 URL" },
      { ok: status.cronSecret, label: "예약 발행 Cron" },
      { ok: status.socialTokenEncryptionKey, label: "토큰 암호화" },
      { ok: status.metaOAuth || status.youtubeOAuth, label: "소셜 OAuth (1개 이상)" },
      { ok: status.kakaoChannel, label: "카카오 채널 ID" },
      { ok: status.googleDrive, label: "Google Drive (선택)" },
      { ok: status.stripe, label: "Stripe (선택)" },
    ];
  }, [status]);

  async function saveCore() {
    setSaving(true);
    try {
      const res = await saveSecrets({
        data: {
          lovableApiKey: lovableApiKey.trim() || undefined,
          appUrl: appUrl.trim() || undefined,
        },
      });
      setPercent(res.percentComplete);
      setStatus(res.status);
      toast.success("AI & 앱 설정 저장 완료");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function saveSecurity() {
    setSaving(true);
    try {
      const res = await saveSecrets({
        data: {
          cronSecret: cronSecret.trim() || undefined,
          socialTokenEncryptionKey: socialTokenEncryptionKey.trim() || undefined,
        },
      });
      setPercent(res.percentComplete);
      setStatus(res.status);
      toast.success("보안 키 저장 완료");
      setCronSecret("");
      setSocialTokenEncryptionKey("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function saveExtras() {
    setSaving(true);
    try {
      const res = await saveSecrets({
        data: {
          googleClientEmail: googleClientEmail.trim() || undefined,
          googlePrivateKey: googlePrivateKey.trim() || undefined,
          googleDriveRootFolderId: googleDriveRootFolderId.trim() || undefined,
          stripeSecretKey: stripeSecretKey.trim() || undefined,
          stripePublishableKey: stripePublishableKey.trim() || undefined,
          stripeWebhookSecret: stripeWebhookSecret.trim() || undefined,
          stripePriceStandard: stripePriceStandard.trim() || undefined,
          stripePricePremium: stripePricePremium.trim() || undefined,
          runwayApiKey: runwayApiKey.trim() || undefined,
        },
      });
      setPercent(res.percentComplete);
      setStatus(res.status);
      toast.success("Drive & 결제 설정 저장 완료");
      setGooglePrivateKey("");
      setStripeSecretKey("");
      setStripeWebhookSecret("");
      setRunwayApiKey("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate(setter: (v: string) => void) {
    try {
      const { token } = await genToken();
      setter(token);
      toast.success("랜덤 키가 생성되었습니다. 저장 버튼을 눌러 적용하세요.");
    } catch {
      toast.error("키 생성 실패");
    }
  }

  async function startCheckout(plan: "standard" | "premium") {
    setBillingLoading(plan);
    try {
      const { url } = await checkout({ data: { plan, storeCode } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "결제 페이지 열기 실패");
    } finally {
      setBillingLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin inline mr-2" />
        설정 마법사 로딩…
      </div>
    );
  }

  const StepIcon = STEPS[step].Icon;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="rounded-2xl bg-brand text-primary-foreground p-6 shadow-navy">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-2xl bg-white/15 grid place-items-center shrink-0">
              <Sparkles className="size-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-xl font-bold">로이어드 설정 마법사</h1>
              <p className="text-sm text-white/80 mt-1">
                API 키를 한곳에서 입력하면 AI 생성·소셜 발행·예약 큐가 바로 동작합니다.
                {canEdit ? " (소유자/관리자 권한)" : " (읽기 전용 — 소유자에게 설정을 요청하세요)"}
              </p>
              <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-xs text-white/70 mt-1">{percent}% 완료</p>
            </div>
          </div>
        </div>

        {/* Step nav */}
        <div className="flex flex-wrap gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(i)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition ${
                step === i
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <s.Icon className="size-3" />
              {s.title}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="rounded-2xl bg-card border border-border p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <StepIcon className="size-4 text-primary" />
            {STEPS[step].title}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                아래 순서대로 진행하면 누구나 15분 안에 운영 환경을 완성할 수 있습니다. Vercel 환경 변수 없이도
                이 화면에서 입력한 값이 DB에 안전하게 저장됩니다.
              </p>
              <div className="flex flex-wrap gap-2">{checklist.map((c) => <StatusChip key={c.label} {...c} />)}</div>
              <ol className="text-sm space-y-2 text-muted-foreground list-decimal list-inside">
                <li>AI API 키 + 앱 URL</li>
                <li>Cron·암호화 키 (자동 생성 가능)</li>
                <li>Instagram / YouTube / 네이버 / TikTok / 카카오 OAuth</li>
                <li>Google Drive · Stripe (선택)</li>
                <li>채널 연결 후 첫 발행!</li>
              </ol>
            </div>
          )}

          {step === 1 && canEdit && (
            <div className="space-y-4">
              <SecretField
                label="Lovable AI API Key"
                hint="AI 본문·이미지·스토리보드 생성에 사용됩니다."
                helpUrl="https://lovable.dev"
                value={lovableApiKey}
                onChange={setLovableApiKey}
                type="password"
                masked={masked.lovableApiKey}
                placeholder="sk-..."
              />
              <SecretField
                label="앱 URL (APP_URL)"
                hint="OAuth 콜백·YouTube 업로드·결제 리다이렉트에 사용됩니다."
                value={appUrl}
                onChange={setAppUrl}
                type="url"
                masked={masked.appUrl}
                placeholder="https://loyadbeta.vercel.app"
              />
              <button
                type="button"
                onClick={() => void saveCore()}
                disabled={saving}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-brand text-primary-foreground text-sm font-semibold disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                이 단계 저장
              </button>
            </div>
          )}

          {step === 2 && canEdit && (
            <div className="space-y-4">
              <SecretField
                label="Cron Secret (예약 발행)"
                hint="Vercel Cron이 /api/cron/social-publish 호출 시 사용합니다."
                value={cronSecret}
                onChange={setCronSecret}
                type="password"
                masked={masked.cronSecret}
              />
              <button
                type="button"
                onClick={() => void handleGenerate(setCronSecret)}
                className="text-xs text-primary font-medium hover:underline"
              >
                <KeyRound className="size-3 inline mr-1" />
                Cron Secret 자동 생성
              </button>
              <SecretField
                label="소셜 토큰 암호화 키"
                hint="OAuth access token을 DB에 암호화 저장할 때 사용합니다."
                value={socialTokenEncryptionKey}
                onChange={setSocialTokenEncryptionKey}
                type="password"
                masked={masked.socialTokenEncryptionKey}
              />
              <button
                type="button"
                onClick={() => void handleGenerate(setSocialTokenEncryptionKey)}
                className="text-xs text-primary font-medium hover:underline"
              >
                <KeyRound className="size-3 inline mr-1" />
                암호화 키 자동 생성
              </button>
              <button
                type="button"
                onClick={() => void saveSecurity()}
                disabled={saving}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-brand text-primary-foreground text-sm font-semibold disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                이 단계 저장
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                각 플랫폼 개발자 콘솔에서 발급받은 Client ID / Secret을 입력한 뒤 저장하세요. 이후 「채널」 탭에서
                계정을 연결합니다.
              </p>
              {canEdit ? (
                <OAuthSettingsPanel embedded />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {status &&
                    (
                      [
                        ["Meta", status.metaOAuth],
                        ["YouTube", status.youtubeOAuth],
                        ["네이버", status.naverOAuth],
                        ["TikTok", status.tiktokOAuth],
                        ["카카오", status.kakaoOAuth],
                      ] as const
                    ).map(([name, ok]) => <StatusChip key={name} ok={ok} label={name} />)}
                </div>
              )}
            </div>
          )}

          {step === 4 && canEdit && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <HardDrive className="size-3.5" /> Google Drive (선택)
                </h3>
                <SecretField
                  label="Service Account Email"
                  helpUrl="https://console.cloud.google.com/iam-admin/serviceaccounts"
                  value={googleClientEmail}
                  onChange={setGoogleClientEmail}
                  masked={masked.googleClientEmail}
                />
                <SecretField
                  label="Private Key (PEM)"
                  hint="JSON 키 파일의 private_key 필드를 붙여넣으세요."
                  value={googlePrivateKey}
                  onChange={setGooglePrivateKey}
                  type="password"
                  masked={masked.googlePrivateKey}
                />
                <SecretField
                  label="루트 폴더 ID"
                  value={googleDriveRootFolderId}
                  onChange={setGoogleDriveRootFolderId}
                  masked={masked.googleDriveRootFolderId}
                  mono
                />
              </div>
              <div className="space-y-3 border-t border-border pt-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <CreditCard className="size-3.5" /> Stripe 결제 (선택)
                </h3>
                <SecretField
                  label="Stripe Secret Key"
                  helpUrl="https://dashboard.stripe.com/apikeys"
                  value={stripeSecretKey}
                  onChange={setStripeSecretKey}
                  type="password"
                  masked={masked.stripeSecretKey}
                  placeholder="sk_test_..."
                />
                <SecretField
                  label="Stripe Publishable Key"
                  value={stripePublishableKey}
                  onChange={setStripePublishableKey}
                  masked={masked.stripePublishableKey}
                  placeholder="pk_test_..."
                />
                <SecretField
                  label="Webhook Secret"
                  hint="엔드포인트: /api/stripe/webhook"
                  value={stripeWebhookSecret}
                  onChange={setStripeWebhookSecret}
                  type="password"
                  masked={masked.stripeWebhookSecret}
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  <SecretField
                    label="Standard Price ID"
                    value={stripePriceStandard}
                    onChange={setStripePriceStandard}
                    masked={masked.stripePriceStandard}
                    mono
                  />
                  <SecretField
                    label="Premium Price ID"
                    value={stripePricePremium}
                    onChange={setStripePricePremium}
                    masked={masked.stripePricePremium}
                    mono
                  />
                </div>
              </div>
              <SecretField
                label="Runway API Key (선택, 영상 렌더)"
                value={runwayApiKey}
                onChange={setRunwayApiKey}
                type="password"
                masked={masked.runwayApiKey}
              />
              <button
                type="button"
                onClick={() => void saveExtras()}
                disabled={saving}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-brand text-primary-foreground text-sm font-semibold disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                이 단계 저장
              </button>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                설정이 {percent}% 완료되었습니다.{" "}
                {percent >= 70
                  ? "이제 채널 탭에서 OAuth 연결 후 첫 콘텐츠를 발행해 보세요!"
                  : "위 단계에서 빨간 항목을 먼저 완료해 주세요."}
              </p>
              <div className="flex flex-wrap gap-2">{checklist.map((c) => <StatusChip key={c.label} {...c} />)}</div>
              {subscription && (
                <p className="text-xs text-muted-foreground">
                  현재 플랜: <strong>{subscription.plan ?? "standard"}</strong> ({subscription.status ?? "inactive"})
                </p>
              )}
              {status?.stripe && storeCode && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={billingLoading !== null}
                    onClick={() => void startCheckout("standard")}
                    className="h-10 px-4 rounded-xl bg-secondary border border-border text-sm font-semibold hover:bg-secondary/80 disabled:opacity-60"
                  >
                    {billingLoading === "standard" ? <Loader2 className="size-4 animate-spin inline" /> : null}
                    Standard 구독
                  </button>
                  <button
                    type="button"
                    disabled={billingLoading !== null}
                    onClick={() => void startCheckout("premium")}
                    className="h-10 px-4 rounded-xl bg-brand text-primary-foreground text-sm font-semibold disabled:opacity-60"
                  >
                    {billingLoading === "premium" ? <Loader2 className="size-4 animate-spin inline" /> : null}
                    Premium 구독
                  </button>
                </div>
              )}
            </div>
          )}

          {!canEdit && step > 0 && step < 3 && (
            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              API 키 입력은 매장 <strong>소유자(owner)</strong> 또는 <strong>관리자(admin)</strong>만 가능합니다.
              Supabase에서 본인 계정에 owner 역할을 부여하거나 관리자에게 요청하세요.
            </p>
          )}
        </div>

        {/* Nav buttons */}
        <div className="flex justify-between">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="inline-flex items-center gap-1 h-10 px-4 rounded-xl border border-border text-sm disabled:opacity-40"
          >
            <ChevronLeft className="size-4" /> 이전
          </button>
          <button
            type="button"
            disabled={step >= STEPS.length - 1}
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="inline-flex items-center gap-1 h-10 px-4 rounded-xl bg-brand text-primary-foreground text-sm font-semibold disabled:opacity-40"
          >
            다음 <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
