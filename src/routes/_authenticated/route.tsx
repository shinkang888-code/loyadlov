import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Store } from "lucide-react";
import logo from "@/assets/loyard-logo.jpg";
import { DEMO_EMAIL, DEMO_PROFILE } from "@/lib/demoAuth.constants";
import { completeOnboardingFn, getCurrentUserFn } from "@/lib/profiles.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthedLayout,
});

type Profile = {
  id: string;
  store_code: string | null;
  business_name: string | null;
  industry: string | null;
  instagram_handle: string | null;
  naver_handle: string | null;
  onboarded_at: string | null;
};

function isDemoUser(user: { email?: string | null; user_metadata?: Record<string, unknown> }): boolean {
  return (
    user.email?.toLowerCase() === DEMO_EMAIL.toLowerCase() ||
    user.user_metadata?.is_demo === true
  );
}

function AuthedLayout() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;

      if (isDemoUser(u.user)) {
        setProfile({
          id: u.user.id,
          store_code: DEMO_PROFILE.store_code,
          business_name: DEMO_PROFILE.business_name,
          industry: DEMO_PROFILE.industry,
          instagram_handle: DEMO_PROFILE.instagram_handle,
          naver_handle: DEMO_PROFILE.naver_handle,
          onboarded_at: new Date().toISOString(),
        });
        return;
      }

      const me = await getCurrentUserFn({ data: {} });
      const row = me.profile as Profile | null;
      if (row) {
        setProfile({
          id: row.id,
          store_code: row.store_code,
          business_name: row.business_name,
          industry: row.industry,
          instagram_handle: row.instagram_handle,
          naver_handle: row.naver_handle,
          onboarded_at: row.onboarded_at,
        });
      } else {
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        워크스페이스 준비 중...
      </div>
    );
  }

  if (!profile?.onboarded_at) {
    return <Onboarding onDone={() => void refresh()} />;
  }

  return <Outlet />;
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [storeCode, setStoreCode] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [instagram, setInstagram] = useState("");
  const [naver, setNaver] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!storeCode) {
      const yr = new Date().getFullYear();
      const rnd = Math.floor(1000 + Math.random() * 9000);
      setStoreCode(`ZA-${yr}-${rnd}`);
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      await completeOnboardingFn({
        data: {
          storeCode,
          businessName,
          industry: industry || undefined,
          instagramHandle: instagram || undefined,
          naverHandle: naver || undefined,
        },
      });
      onDone();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Loyard" className="size-9 rounded-xl object-cover ring-1 ring-primary/15" />
          <span className="font-display font-bold tracking-tight">로이어드</span>
        </div>
        <button
          onClick={() => void supabase.auth.signOut().then(() => navigate({ to: "/" }))}
          className="text-xs text-muted-foreground hover:text-foreground transition"
        >
          로그아웃
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 rounded-full px-3 py-1 mb-4">
              <Sparkles className="size-3.5" /> 첫 설정 (1분)
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">매장 정보를 알려주세요</h1>
            <p className="text-sm text-muted-foreground mt-2">
              AI가 매장에 맞춘 SNS 콘텐츠를 만들기 위해 기본 정보를 받습니다.
            </p>
          </div>

          <form
            onSubmit={(e) => void submit(e)}
            className="glass rounded-2xl border border-border/60 shadow-soft p-6 sm:p-8 grid gap-5"
          >
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="store_code">매장 코드</Label>
                <div className="relative">
                  <Store className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="store_code"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value)}
                    className="h-11 pl-9 font-mono"
                    required
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">동일 매장 팀원과 워크스페이스를 공유합니다.</p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="business_name">상호명</Label>
                <Input
                  id="business_name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="예) 로이어드 베이커리"
                  className="h-11"
                  required
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="industry">업종</Label>
              <Input
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="예) 카페 / 베이커리 / 헤어샵"
                className="h-11"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="ig">Instagram 핸들</Label>
                <Input
                  id="ig"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@loyard.kr"
                  className="h-11"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="naver">네이버 플레이스</Label>
                <Input
                  id="naver"
                  value={naver}
                  onChange={(e) => setNaver(e.target.value)}
                  placeholder="플레이스 URL 또는 ID"
                  className="h-11"
                />
              </div>
            </div>

            {err && (
              <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
                {err}
              </p>
            )}

            <Button type="submit" disabled={saving} className="h-11 w-full">
              {saving ? "저장 중..." : "워크스페이스 입장하기"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
