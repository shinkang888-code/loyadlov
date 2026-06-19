// filepath: src/components/ChannelOAuthConnectDialog.tsx
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getOAuthSettingsFn,
  saveMetaOAuthSettingsFn,
  saveNaverOAuthSettingsFn,
  saveYouTubeOAuthSettingsFn,
  saveTikTokOAuthSettingsFn,
  saveKakaoOAuthSettingsFn,
} from "@/lib/social.functions";
import { useSocialAccounts } from "@/hooks/useSocialAccounts";
import { SOCIAL_PLATFORM_LABELS } from "@/lib/social/types";
import { Check, Link2, Loader2, Save, ShieldCheck } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
  storeCode?: string;
};

type Step = "credentials" | "connect";

export function ChannelOAuthConnectDialog({ open, onOpenChange, onConnected, storeCode }: Props) {
  const getSettings = useServerFn(getOAuthSettingsFn);
  const saveMeta = useServerFn(saveMetaOAuthSettingsFn);
  const saveYouTube = useServerFn(saveYouTubeOAuthSettingsFn);
  const saveNaver = useServerFn(saveNaverOAuthSettingsFn);
  const saveTikTok = useServerFn(saveTikTokOAuthSettingsFn);
  const saveKakao = useServerFn(saveKakaoOAuthSettingsFn);
  const { config, refresh, isConnected } = useSocialAccounts(storeCode);

  const [step, setStep] = useState<Step>("credentials");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [metaAppId, setMetaAppId] = useState("");
  const [metaAppSecret, setMetaAppSecret] = useState("");
  const [metaEnabled, setMetaEnabled] = useState(true);
  const [youtubeClientId, setYoutubeClientId] = useState("");
  const [youtubeClientSecret, setYoutubeClientSecret] = useState("");
  const [youtubeEnabled, setYoutubeEnabled] = useState(true);
  const [naverClientId, setNaverClientId] = useState("");
  const [naverClientSecret, setNaverClientSecret] = useState("");
  const [naverEnabled, setNaverEnabled] = useState(true);
  const [tiktokClientKey, setTiktokClientKey] = useState("");
  const [tiktokClientSecret, setTiktokClientSecret] = useState("");
  const [tiktokEnabled, setTiktokEnabled] = useState(true);
  const [kakaoRestKey, setKakaoRestKey] = useState("");
  const [kakaoClientSecret, setKakaoClientSecret] = useState("");
  const [kakaoEnabled, setKakaoEnabled] = useState(true);

  const [status, setStatus] = useState({
    meta: false,
    youtube: false,
    naver: false,
    tiktok: false,
    kakao: false,
  });

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSettings();
      setStatus({
        meta: s.meta.configured,
        youtube: s.youtube.configured,
        naver: s.naver.configured,
        tiktok: s.tiktok.configured,
        kakao: s.kakao.configured,
      });
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [getSettings, refresh]);

  useEffect(() => {
    if (open) {
      void loadStatus();
      setStep("credentials");
    }
  }, [open, loadStatus]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        saveMeta({
          data: {
            settings: {
              appId: metaAppId.trim() || undefined,
              appSecret: metaAppSecret.trim() || undefined,
              enabled: metaEnabled,
            },
          },
        }),
        saveYouTube({
          data: {
            settings: {
              clientId: youtubeClientId.trim() || undefined,
              clientSecret: youtubeClientSecret.trim() || undefined,
              enabled: youtubeEnabled,
            },
          },
        }),
        saveNaver({
          data: {
            settings: {
              clientId: naverClientId.trim() || undefined,
              clientSecret: naverClientSecret.trim() || undefined,
              enabled: naverEnabled,
            },
          },
        }),
        saveTikTok({
          data: {
            settings: {
              clientKey: tiktokClientKey.trim() || undefined,
              clientSecret: tiktokClientSecret.trim() || undefined,
              enabled: tiktokEnabled,
            },
          },
        }),
        saveKakao({
          data: {
            settings: {
              restApiKey: kakaoRestKey.trim() || undefined,
              clientSecret: kakaoClientSecret.trim() || undefined,
              enabled: kakaoEnabled,
            },
          },
        }),
      ]);
      toast.success("OAuth API 설정 저장 완료");
      const s = await getSettings();
      setStatus({
        meta: s.meta.configured,
        youtube: s.youtube.configured,
        naver: s.naver.configured,
        tiktok: s.tiktok.configured,
        kakao: s.kakao.configured,
      });
      await refresh();
      setStep("connect");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const startOAuth = async (path: string) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      toast.error("로그인이 필요합니다.");
      return;
    }
    const qs = new URLSearchParams({ token });
    if (storeCode) qs.set("storeCode", storeCode);
    window.location.href = `${path}?${qs.toString()}`;
  };

  const allConfigured =
    status.meta || status.youtube || status.naver || status.tiktok || status.kakao;
  const effectiveConfig = {
    meta: status.meta || config.meta,
    youtube: status.youtube || config.youtube,
    naver: status.naver || config.naver,
    tiktok: status.tiktok || config.tiktok,
    kakao: status.kakao || config.kakao,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            채널 OAuth 연결
          </DialogTitle>
          <DialogDescription>
            플랫폼 API 자격증명을 입력한 뒤, 각 채널 계정을 OAuth로 연결하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setStep("credentials")}
            className={`flex-1 py-2 rounded-lg font-semibold transition ${
              step === "credentials"
                ? "bg-brand text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            1. API 설정
          </button>
          <button
            type="button"
            onClick={() => setStep("connect")}
            disabled={
              !allConfigured &&
              !effectiveConfig.meta &&
              !effectiveConfig.youtube &&
              !effectiveConfig.naver &&
              !effectiveConfig.tiktok &&
              !effectiveConfig.kakao
            }
            className={`flex-1 py-2 rounded-lg font-semibold transition disabled:opacity-40 ${
              step === "connect"
                ? "bg-brand text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            2. 계정 연결
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin inline mr-2" />
            설정 확인 중…
          </div>
        ) : step === "credentials" ? (
          <div className="space-y-4">
            <OAuthFieldGroup
              title="Meta (Instagram + Threads)"
              enabled={metaEnabled}
              onEnabledChange={setMetaEnabled}
              configured={status.meta}
              idPlaceholder="META_APP_ID"
              secretPlaceholder="META_APP_SECRET"
              idValue={metaAppId}
              secretValue={metaAppSecret}
              onIdChange={setMetaAppId}
              onSecretChange={setMetaAppSecret}
            />
            <OAuthFieldGroup
              title="YouTube (Google OAuth)"
              enabled={youtubeEnabled}
              onEnabledChange={setYoutubeEnabled}
              configured={status.youtube}
              idPlaceholder="GOOGLE_OAUTH_CLIENT_ID"
              secretPlaceholder="GOOGLE_OAUTH_CLIENT_SECRET"
              idValue={youtubeClientId}
              secretValue={youtubeClientSecret}
              onIdChange={setYoutubeClientId}
              onSecretChange={setYoutubeClientSecret}
            />
            <OAuthFieldGroup
              title="네이버 블로그"
              enabled={naverEnabled}
              onEnabledChange={setNaverEnabled}
              configured={status.naver}
              idPlaceholder="NAVER_OAUTH_CLIENT_ID"
              secretPlaceholder="NAVER_OAUTH_CLIENT_SECRET"
              idValue={naverClientId}
              secretValue={naverClientSecret}
              onIdChange={setNaverClientId}
              onSecretChange={setNaverClientSecret}
            />
            <OAuthFieldGroup
              title="TikTok"
              enabled={tiktokEnabled}
              onEnabledChange={setTiktokEnabled}
              configured={status.tiktok}
              idPlaceholder="TIKTOK_CLIENT_KEY"
              secretPlaceholder="TIKTOK_CLIENT_SECRET"
              idValue={tiktokClientKey}
              secretValue={tiktokClientSecret}
              onIdChange={setTiktokClientKey}
              onSecretChange={setTiktokClientSecret}
            />
            <OAuthFieldGroup
              title="카카오톡"
              enabled={kakaoEnabled}
              onEnabledChange={setKakaoEnabled}
              configured={status.kakao}
              idPlaceholder="KAKAO_REST_API_KEY"
              secretPlaceholder="KAKAO_CLIENT_SECRET"
              idValue={kakaoRestKey}
              secretValue={kakaoClientSecret}
              onIdChange={setKakaoRestKey}
              onSecretChange={setKakaoClientSecret}
            />

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="w-full h-10 rounded-xl bg-brand text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              설정 저장
            </button>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              환경 변수로도 설정 가능합니다. DB 저장값과 env가 모두 있으면 env가 우선 적용됩니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Link2 className="size-3.5" />
              아래 버튼을 눌러 각 플랫폼 계정을 연결하세요.
            </p>

            <ConnectRow
              label="Meta (Instagram + Threads)"
              connected={isConnected("instagram") && isConnected("threads")}
              partial={isConnected("instagram") !== isConnected("threads")}
              configured={effectiveConfig.meta}
              onConnect={() => void startOAuth("/api/social/meta/oauth/start")}
            />
            <ConnectRow
              label={SOCIAL_PLATFORM_LABELS.youtube}
              connected={isConnected("youtube")}
              configured={effectiveConfig.youtube}
              onConnect={() => void startOAuth("/api/social/youtube/oauth/start")}
            />
            <ConnectRow
              label={SOCIAL_PLATFORM_LABELS.naver_blog}
              connected={isConnected("naver_blog")}
              configured={effectiveConfig.naver}
              onConnect={() => void startOAuth("/api/social/naver/oauth/start")}
            />
            <ConnectRow
              label={SOCIAL_PLATFORM_LABELS.tiktok}
              connected={isConnected("tiktok")}
              configured={effectiveConfig.tiktok}
              onConnect={() => void startOAuth("/api/social/tiktok/oauth/start")}
            />
            <ConnectRow
              label={SOCIAL_PLATFORM_LABELS.kakao}
              connected={isConnected("kakao")}
              configured={effectiveConfig.kakao}
              onConnect={() => void startOAuth("/api/social/kakao/oauth/start")}
            />

            <button
              type="button"
              onClick={() => {
                onConnected?.();
                onOpenChange(false);
              }}
              className="w-full h-10 rounded-xl bg-secondary border border-border text-sm font-semibold mt-2"
            >
              완료
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OAuthFieldGroup({
  title,
  enabled,
  onEnabledChange,
  configured,
  idPlaceholder,
  secretPlaceholder,
  idValue,
  secretValue,
  onIdChange,
  onSecretChange,
}: {
  title: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  configured: boolean;
  idPlaceholder: string;
  secretPlaceholder: string;
  idValue: string;
  secretValue: string;
  onIdChange: (v: string) => void;
  onSecretChange: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border p-4 space-y-3 bg-secondary/30">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {configured && (
          <span className="text-[10px] font-semibold text-emerald-600 inline-flex items-center gap-1">
            <Check className="size-3" /> 설정됨
          </span>
        )}
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} />
        활성화
      </label>
      <input
        value={idValue}
        onChange={(e) => onIdChange(e.target.value)}
        placeholder={idPlaceholder}
        className="w-full h-9 px-3 rounded-lg bg-background border border-border text-sm"
      />
      <input
        value={secretValue}
        onChange={(e) => onSecretChange(e.target.value)}
        placeholder={secretPlaceholder}
        type="password"
        className="w-full h-9 px-3 rounded-lg bg-background border border-border text-sm"
      />
    </div>
  );
}

function ConnectRow({
  label,
  connected,
  partial,
  configured,
  onConnect,
}: {
  label: string;
  connected: boolean;
  partial?: boolean;
  configured: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-secondary/30">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">
          {connected ? (
            <span className="text-emerald-600 font-semibold">연결됨</span>
          ) : partial ? (
            <span className="text-amber-600 font-semibold">부분 연결</span>
          ) : (
            "미연결"
          )}
        </div>
      </div>
      <button
        type="button"
        disabled={!configured || connected}
        onClick={onConnect}
        className="px-3 py-1.5 rounded-lg bg-brand text-primary-foreground text-xs font-semibold disabled:opacity-40 shrink-0"
      >
        {connected ? "완료" : "연결하기"}
      </button>
    </div>
  );
}
