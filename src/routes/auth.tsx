import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAuthCallbackUrl } from "@/integrations/neon/auth-config";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, ArrowLeft, Play } from "lucide-react";
import logo from "@/assets/loyard-logo.jpg";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demoAuth.constants";
import { demoLoginFn } from "@/lib/demoAuth.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "로이어드 로그인 — Loyard" },
      { name: "description", content: "로이어드에 로그인하고 AI SNS 운영을 시작하세요." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/admin" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: getAuthCallbackUrl("/admin") },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "인증에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setErr(null);
    setLoading(true);
    try {
      // 1) 서버: 데모 계정·프로필 DB 보장 (Auth REST — getSession 불필요)
      try {
        await demoLoginFn({ data: {} });
      } catch (e) {
        console.warn("demoLoginFn profile sync:", e);
      }

      // 2) 클라이언트 로그인 (same-origin /api/auth 프록시)
      const signIn = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (signIn.error) throw signIn.error;
      navigate({ to: "/admin" });
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : "데모 로그인에 실패했습니다.";
      setErr(
        msg.includes("Missing") && msg.includes("AUTH")
          ? "Neon Auth URL이 설정되지 않았습니다. Vercel에 NEON_AUTH_URL을 추가해 주세요."
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setErr(null);
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: getAuthCallbackUrl("/admin"),
      });
      if (result.error) {
        setErr(result.error instanceof Error ? result.error.message : "Google 로그인 실패");
        setLoading(false);
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Google 로그인 실패");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <header className="px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="size-4" /> 홈으로
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center text-center mb-8">
            <img
              src={logo}
              alt="Loyard"
              className="size-16 rounded-2xl object-cover ring-1 ring-primary/15 shadow-soft mb-4"
            />
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "signin" ? "다시 오신 걸 환영합니다" : "로이어드 시작하기"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {mode === "signin"
                ? "계정에 로그인해 워크스페이스로 이동합니다."
                : "1분 만에 가입하고 첫 7일을 무료로 사용해 보세요."}
            </p>
          </div>

          <div className="glass rounded-2xl p-6 sm:p-8 shadow-soft border border-border/60">
            {err && (
              <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2 mb-4">
                {err}
              </p>
            )}

            <Button
              type="button"
              variant="secondary"
              className="w-full h-11 mb-2"
              disabled={loading}
              onClick={() => void handleDemo()}
            >
              {loading ? (
                <>접속 중...</>
              ) : (
                <>
                  <Play className="size-4 mr-2" />
                  데모로 둘러보기
                </>
              )}
            </Button>
            <p className="text-[11px] text-center text-muted-foreground mb-5">
              Google 연동 없이 바로 대시보드를 체험합니다
            </p>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11"
              disabled={loading}
              onClick={() => void handleGoogle()}
            >
              <svg className="size-4 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 계속하기
            </Button>

            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              또는 이메일
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={(e) => void handleEmail(e)} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@store.com"
                  required
                  className="h-11"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6자 이상"
                  required
                  minLength={6}
                  className="h-11"
                />
              </div>


              <Button type="submit" disabled={loading} className="w-full h-11">
                <Sparkles className="size-4 mr-1.5" />
                {loading ? "처리 중..." : mode === "signin" ? "로그인" : "회원가입"}
              </Button>
            </form>

            <button
              type="button"
              className="mt-5 w-full text-center text-xs text-muted-foreground hover:text-primary transition"
              onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
            >
              {mode === "signin" ? "처음이신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
            </button>
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground leading-relaxed">
            로그인 시 로이어드의 <span className="underline">서비스 약관</span> 및{" "}
            <span className="underline">개인정보처리방침</span>에 동의하게 됩니다.
          </p>
        </div>
      </main>
    </div>
  );
}
