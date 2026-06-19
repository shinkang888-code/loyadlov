// filepath: src/components/OAuthSettingsPanel.tsx
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import {
  getOAuthSettingsFn,
  saveMetaOAuthSettingsFn,
  saveNaverOAuthSettingsFn,
  saveYouTubeOAuthSettingsFn,
  saveTikTokOAuthSettingsFn,
  saveKakaoOAuthSettingsFn,
} from "@/lib/social.functions";

export function OAuthSettingsPanel() {
  const getSettings = useServerFn(getOAuthSettingsFn);
  const saveMeta = useServerFn(saveMetaOAuthSettingsFn);
  const saveNaver = useServerFn(saveNaverOAuthSettingsFn);
  const saveYouTube = useServerFn(saveYouTubeOAuthSettingsFn);
  const saveTikTok = useServerFn(saveTikTokOAuthSettingsFn);
  const saveKakao = useServerFn(saveKakaoOAuthSettingsFn);

  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    void getSettings()
      .then((s) => {
        setStatus({
          meta: s.meta.configured,
          youtube: s.youtube.configured,
          naver: s.naver.configured,
          tiktok: s.tiktok.configured,
          kakao: s.kakao.configured,
        });
      })
      .finally(() => setLoading(false));
  }, [getSettings]);

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
      toast.success("OAuth 설정 저장 완료");
      const s = await getSettings();
      setStatus({
        meta: s.meta.configured,
        youtube: s.youtube.configured,
        naver: s.naver.configured,
        tiktok: s.tiktok.configured,
        kakao: s.kakao.configured,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin inline mr-2" /> 설정 로딩…
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto flex-1 max-w-2xl">
      <div className="rounded-2xl bg-card border border-border p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <ShieldCheck className="size-4 text-primary" /> OAuth 연동 상태
        </h2>
        <ul className="space-y-2 text-sm">
          <li>Meta (Instagram/Threads): {status.meta ? "✅ 설정됨" : "❌ 미설정"}</li>
          <li>YouTube (Google OAuth): {status.youtube ? "✅ 설정됨" : "❌ 미설정"}</li>
          <li>네이버 블로그: {status.naver ? "✅ 설정됨" : "❌ 미설정"}</li>
          <li>TikTok: {status.tiktok ? "✅ 설정됨" : "❌ 미설정"}</li>
          <li>카카오톡: {status.kakao ? "✅ 설정됨" : "❌ 미설정"}</li>
        </ul>
      </div>

      <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold">Meta OAuth (관리자 DB 설정)</h3>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={metaEnabled} onChange={(e) => setMetaEnabled(e.target.checked)} />
          활성화
        </label>
        <input
          value={metaAppId}
          onChange={(e) => setMetaAppId(e.target.value)}
          placeholder="META_APP_ID"
          className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
        />
        <input
          value={metaAppSecret}
          onChange={(e) => setMetaAppSecret(e.target.value)}
          placeholder="META_APP_SECRET"
          type="password"
          className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
        />
      </div>

      <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold">YouTube OAuth (관리자 DB 설정)</h3>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={youtubeEnabled} onChange={(e) => setYoutubeEnabled(e.target.checked)} />
          활성화
        </label>
        <input
          value={youtubeClientId}
          onChange={(e) => setYoutubeClientId(e.target.value)}
          placeholder="GOOGLE_OAUTH_CLIENT_ID"
          className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
        />
        <input
          value={youtubeClientSecret}
          onChange={(e) => setYoutubeClientSecret(e.target.value)}
          placeholder="GOOGLE_OAUTH_CLIENT_SECRET"
          type="password"
          className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
        />
      </div>

      <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold">네이버 OAuth (관리자 DB 설정)</h3>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={naverEnabled} onChange={(e) => setNaverEnabled(e.target.checked)} />
          활성화
        </label>
        <input
          value={naverClientId}
          onChange={(e) => setNaverClientId(e.target.value)}
          placeholder="NAVER_OAUTH_CLIENT_ID"
          className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
        />
        <input
          value={naverClientSecret}
          onChange={(e) => setNaverClientSecret(e.target.value)}
          placeholder="NAVER_OAUTH_CLIENT_SECRET"
          type="password"
          className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
        />
      </div>

      <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold">TikTok OAuth (관리자 DB 설정)</h3>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={tiktokEnabled} onChange={(e) => setTiktokEnabled(e.target.checked)} />
          활성화
        </label>
        <input
          value={tiktokClientKey}
          onChange={(e) => setTiktokClientKey(e.target.value)}
          placeholder="TIKTOK_CLIENT_KEY"
          className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
        />
        <input
          value={tiktokClientSecret}
          onChange={(e) => setTiktokClientSecret(e.target.value)}
          placeholder="TIKTOK_CLIENT_SECRET"
          type="password"
          className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
        />
      </div>

      <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold">카카오 OAuth (관리자 DB 설정)</h3>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={kakaoEnabled} onChange={(e) => setKakaoEnabled(e.target.checked)} />
          활성화
        </label>
        <input
          value={kakaoRestKey}
          onChange={(e) => setKakaoRestKey(e.target.value)}
          placeholder="KAKAO_REST_API_KEY"
          className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
        />
        <input
          value={kakaoClientSecret}
          onChange={(e) => setKakaoClientSecret(e.target.value)}
          placeholder="KAKAO_CLIENT_SECRET"
          type="password"
          className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm"
        />
      </div>

      <button
        onClick={() => void handleSave()}
        disabled={saving}
        className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-brand text-primary-foreground text-sm font-semibold disabled:opacity-60"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        설정 저장
      </button>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        환경 변수(META_APP_ID, GOOGLE_OAUTH_CLIENT_ID, NAVER_OAUTH_CLIENT_ID, TIKTOK_CLIENT_KEY, KAKAO_REST_API_KEY,
        CRON_SECRET, SOCIAL_TOKEN_ENCRYPTION_KEY)도 지원합니다. 예약 발행 cron: GET /api/cron/social-publish
        (Authorization: Bearer CRON_SECRET)
      </p>
    </div>
  );
}
