import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Sparkles,
  Zap,
  Rocket,
  ShieldCheck,
  Instagram,
  Music2,
  MessageCircle,
  Globe,
  Bot,
  ImageIcon,
  Send,
  ArrowRight,
  Check,
  Workflow,
  Cloud,
  Wand2,
} from "lucide-react";
import hero from "@/assets/hero.jpg";
import showcase1 from "@/assets/showcase-1.jpg";
import showcase2 from "@/assets/showcase-2.jpg";
import showcase3 from "@/assets/showcase-3.jpg";
import owner from "@/assets/owner.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "로이어드 Loyard — AI SNS 피드 자동화 플랫폼" },
      {
        name: "description",
        content:
          "자영업자를 위한 AI 기반 SNS 피드 자동 생성 & 대행 SaaS. 인스타·틱톡·네이버·카카오를 한 번에. 콘텐츠는 AI가, 운영은 전담 크루가.",
      },
      { property: "og:title", content: "로이어드 Loyard — AI SNS 피드 자동화 플랫폼" },
      {
        property: "og:description",
        content: "AI가 만들고 크루가 운영하는, 자영업자를 위한 SNS 피드 대행 플랫폼.",
      },
      { property: "og:image", content: hero },
    ],
  }),
  component: Landing,
});

function Landing() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="dark min-h-screen bg-background text-foreground overflow-x-hidden">
      <Nav />
      <Hero />
      <LogoStrip />
      <Features />
      <Showcase />
      <Workflow2 />
      <Dashboard />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="glass rounded-full px-5 py-3 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-brand grid place-items-center glow">
              <Sparkles className="size-4 text-white" />
            </div>
            <span className="font-display font-bold tracking-tight text-lg">로이어드</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">Loyard</span>
          </a>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">기능</a>
            <a href="#showcase" className="hover:text-foreground transition">사례</a>
            <a href="#workflow" className="hover:text-foreground transition">작동방식</a>
            <a href="#pricing" className="hover:text-foreground transition">요금</a>
          </nav>
          <a
            href="#cta"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white glow hover:opacity-90 transition"
          >
            시작하기 <ArrowRight className="size-3.5" />
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative pt-36 pb-24 md:pt-44 md:pb-32 bg-hero overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-primary/20 blur-[120px] animate-pulse-glow" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs text-muted-foreground mb-7">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            AI × 전담 크루가 함께 운영하는 SNS 피드 SaaS
          </div>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold leading-[1.05] tracking-tight">
            <span className="text-gradient">콘텐츠는 AI가,</span>
            <br />
            <span className="text-brand-gradient">운영은 로이어드가.</span>
          </h1>
          <p className="mt-7 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            자영업자를 위한 단 하나의 SNS 자동화 플랫폼.
            <br className="hidden md:block" />
            인스타 · 틱톡 · 네이버 · 카카오 피드를 매일 자동 생성하고 발행합니다.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#cta"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-semibold text-white glow hover:scale-[1.02] transition"
            >
              무료로 채널 연동하기 <ArrowRight className="size-4" />
            </a>
            <a
              href="#showcase"
              className="inline-flex items-center gap-2 rounded-full glass px-6 py-3.5 text-sm font-medium hover:bg-white/10 transition"
            >
              실제 생성 사례 보기
            </a>
          </div>
        </div>

        <div className="relative mt-20 md:mt-24 mx-auto max-w-5xl">
          <div className="absolute -inset-8 bg-primary/30 blur-[100px] rounded-full" />
          <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)]">
            <img
              src={hero}
              alt="AI 콘텐츠 신경망 시각화"
              width={1920}
              height={1280}
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function LogoStrip() {
  const channels = [
    { name: "Instagram", icon: Instagram },
    { name: "TikTok", icon: Music2 },
    { name: "KakaoTalk", icon: MessageCircle },
    { name: "Naver", icon: Globe },
  ];
  return (
    <section className="py-12 border-y border-white/5">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-muted-foreground mb-8">
          연동 채널
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-6 text-muted-foreground">
          {channels.map((c) => (
            <div key={c.name} className="flex items-center gap-2 hover:text-foreground transition">
              <c.icon className="size-5" />
              <span className="font-display font-semibold tracking-tight">{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: Bot,
      title: "업종별 학습된 AI 본문",
      desc: "요식업·뷰티·리테일 등 업종별 톤앤매너로 GPT·Claude가 본문 + 해시태그 5조합을 동시 출력합니다.",
    },
    {
      icon: ImageIcon,
      title: "실사풍 이미지·영상 생성",
      desc: "Midjourney·SD·Sora 템플릿으로 매장 컨셉에 맞춘 콘텐츠 비주얼을 자동 빌드합니다.",
    },
    {
      icon: Send,
      title: "원클릭 다채널 배포",
      desc: "공식 Partner API와 Headless 자동화를 병행해 안전하게 인스타·틱톡·네이버에 동시 발행합니다.",
    },
    {
      icon: Cloud,
      title: "구글드라이브 자동 백업",
      desc: "/UID_상호명/연-월_콘텐츠/ 구조로 모든 결과물을 사장님 드라이브에 자동 정리합니다.",
    },
    {
      icon: ShieldCheck,
      title: "계정 차단 방지 설계",
      desc: "Stealth 플러그인 + 지역 기반 주거용 프록시로 소중한 마케팅 계정을 안전하게 운영합니다.",
    },
    {
      icon: Workflow,
      title: "전담 크루 매니저",
      desc: "UID 발급과 동시에 전담 크루가 배정되어 콘텐츠 승인, 일정, 보고까지 책임집니다.",
    },
  ];

  return (
    <section id="features" className="py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm text-primary font-medium mb-3">FEATURES</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            매장이 바쁠수록,
            <br />
            <span className="text-brand-gradient">SNS는 더 잘 굴러갑니다.</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-lg">
            로이어드는 AI 생성 엔진과 전담 운영 크루가 한 팀으로 움직이는 하이브리드 SaaS입니다.
          </p>
        </div>

        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((it) => (
            <div
              key={it.title}
              className="group relative rounded-3xl glass p-7 hover:bg-white/[0.07] transition overflow-hidden"
            >
              <div className="absolute -top-20 -right-20 size-48 rounded-full bg-primary/20 blur-3xl opacity-0 group-hover:opacity-100 transition" />
              <div className="relative">
                <div className="size-12 rounded-2xl bg-brand/20 border border-primary/30 grid place-items-center mb-5">
                  <it.icon className="size-5 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold">{it.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{it.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section id="showcase" className="py-28 md:py-36 relative">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm text-primary font-medium mb-3">SHOWCASE</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            <span className="text-gradient">사장님은 영업만,</span>
            <br />
            피드는 알아서 빛납니다.
          </h2>
        </div>

        <div className="grid md:grid-cols-12 gap-5">
          <div className="md:col-span-7 relative rounded-3xl overflow-hidden border border-white/10 group">
            <img
              src={showcase2}
              alt="미나리 삼겹살 콘텐츠"
              loading="lazy"
              width={1080}
              height={1600}
              className="w-full h-[520px] object-cover group-hover:scale-105 transition duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute bottom-0 left-0 p-8">
              <p className="text-xs uppercase tracking-widest text-primary mb-2">요식업 · 미나리삼겹살</p>
              <h3 className="font-display text-2xl md:text-3xl font-bold leading-tight">
                "감성 식당 톤"으로 매일 1피드
                <br />
                자동 발행 중
              </h3>
            </div>
          </div>
          <div className="md:col-span-5 grid grid-rows-2 gap-5">
            <div className="relative rounded-3xl overflow-hidden border border-white/10 group">
              <img
                src={showcase1}
                alt="인스타그램 피드 자동 생성"
                loading="lazy"
                width={1280}
                height={1280}
                className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6">
                <p className="text-xs uppercase tracking-widest text-primary mb-1">INSTAGRAM</p>
                <h4 className="font-display text-lg font-semibold">피드 + 릴스 동시 생성</h4>
              </div>
            </div>
            <div className="relative rounded-3xl overflow-hidden border border-white/10 group">
              <img
                src={owner}
                alt="자영업 사장님"
                loading="lazy"
                width={1080}
                height={1500}
                className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/85 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6">
                <p className="text-xs uppercase tracking-widest text-primary mb-1">CAFE · 카페</p>
                <h4 className="font-display text-lg font-semibold">"하루 5분이면 충분해요"</h4>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Workflow2() {
  const steps = [
    { n: "01", t: "1분 채널 연동", d: "카카오/구글/인스타/틱톡 OAuth 한 번에. UID #ZA-2026-XXXX 즉시 발급." },
    { n: "02", t: "전담 크루 배정", d: "업종·톤앤매너 가이드라인 기반으로 전담 매니저가 콘텐츠를 기획합니다." },
    { n: "03", t: "AI 콘텐츠 생성", d: "본문 · 해시태그 · 이미지 · 영상까지 AI 파이프라인이 자동 생성합니다." },
    { n: "04", t: "원클릭 발행 & 백업", d: "공식 API + Stealth 자동화로 안전 발행. 구글드라이브에 자동 보관." },
  ];
  return (
    <section id="workflow" className="py-28 md:py-36 relative">
      <div className="absolute inset-0 grid-bg opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="max-w-2xl mb-16">
          <p className="text-sm text-primary font-medium mb-3">HOW IT WORKS</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            가입부터 발행까지
            <br />
            <span className="text-brand-gradient">단 4단계.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="relative rounded-3xl glass p-7 hover:bg-white/[0.07] transition"
            >
              <div className="font-display text-5xl font-bold text-brand-gradient">{s.n}</div>
              <h3 className="mt-4 font-display text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 size-6 rounded-full bg-background border border-primary/40 grid place-items-center">
                  <ArrowRight className="size-3 text-primary" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Dashboard() {
  return (
    <section className="py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-sm text-primary font-medium mb-3">CONTROL CENTER</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              운영 크루를 위한
              <br />
              <span className="text-gradient">AI 콘트롤 센터.</span>
            </h2>
            <p className="mt-5 text-muted-foreground text-lg leading-relaxed">
              좌측 사이드바, 중앙 작업 영역, 우측 AI 보조 패널의 3단 스플릿 스크린.
              회원 UID 검색 한 번으로 점포 가이드라인이 자동 활성화되고, 텍스트·이미지·영상을 동시에 다룹니다.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "GPT·Claude 본문 + 해시태그 5조합 동시 출력",
                "Midjourney·SD 프롬프트 빌더 + 레이어 편집",
                "Redis Queue 기반 비동기 대량 생성",
                "WebSocket 실시간 진행 상황 알림",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm">
                  <div className="mt-0.5 size-5 rounded-full bg-brand/20 border border-primary/40 grid place-items-center shrink-0">
                    <Check className="size-3 text-primary" />
                  </div>
                  <span className="text-muted-foreground">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 bg-primary/30 blur-[100px] rounded-full" />
            <div className="relative rounded-3xl overflow-hidden border border-white/10 animate-float">
              <img
                src={showcase3}
                alt="관리자 대시보드"
                loading="lazy"
                width={1600}
                height={1200}
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      name: "Standard",
      price: "₩290,000",
      period: "/월",
      desc: "1인 매장 · 1채널 운영에 최적",
      features: ["주 3회 콘텐츠 자동 생성", "1개 채널 자동 발행", "구글드라이브 백업", "전담 크루 매칭"],
      highlight: false,
    },
    {
      name: "Premium",
      price: "₩590,000",
      period: "/월",
      desc: "다채널 · 다지점 사장님 대상",
      features: [
        "매일 콘텐츠 자동 생성",
        "4개 채널 동시 발행 (IG·TT·NV·KK)",
        "실사풍 이미지 + 영상 생성",
        "지역 기반 프록시 안전 발행",
        "월간 성과 리포트",
      ],
      highlight: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      desc: "프랜차이즈 · 다지점 본사용",
      features: ["지점별 워크스페이스 분리", "전담 운영팀", "API 연동", "SLA 보장"],
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-sm text-primary font-medium mb-3">PRICING</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
            매장 규모에 맞춰,
            <br />
            <span className="text-brand-gradient">합리적으로.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-3xl p-8 ${
                p.highlight
                  ? "bg-brand glow border border-primary/50"
                  : "glass hover:bg-white/[0.07] transition"
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background text-primary border border-primary/40 rounded-full px-3 py-1 text-xs font-semibold">
                  Most Popular
                </div>
              )}
              <h3 className="font-display text-xl font-semibold">{p.name}</h3>
              <p className={`text-sm mt-1 ${p.highlight ? "text-white/80" : "text-muted-foreground"}`}>
                {p.desc}
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold">{p.price}</span>
                <span className={p.highlight ? "text-white/70" : "text-muted-foreground"}>{p.period}</span>
              </div>
              <ul className="mt-7 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check
                      className={`size-4 mt-0.5 shrink-0 ${
                        p.highlight ? "text-white" : "text-primary"
                      }`}
                    />
                    <span className={p.highlight ? "text-white/90" : "text-muted-foreground"}>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#cta"
                className={`mt-8 w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${
                  p.highlight
                    ? "bg-white text-primary hover:bg-white/90"
                    : "glass hover:bg-white/10"
                }`}
              >
                상담 신청
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="cta" className="py-28 md:py-36">
      <div className="mx-auto max-w-5xl px-6">
        <div className="relative rounded-[2.5rem] overflow-hidden bg-brand p-12 md:p-20 text-center glow">
          <div className="absolute inset-0 grid-bg opacity-20" />
          <div className="absolute -top-20 -right-20 size-80 rounded-full bg-white/20 blur-3xl" />
          <div className="relative">
            <Wand2 className="size-10 mx-auto text-white mb-6" />
            <h2 className="font-display text-4xl md:text-6xl font-bold text-white tracking-tight leading-tight">
              오늘부터 SNS는
              <br />
              로이어드에게 맡기세요.
            </h2>
            <p className="mt-5 text-white/80 text-lg max-w-xl mx-auto">
              5분 채널 연동, 즉시 전담 크루 배정. 첫 7일은 무료로 운영해 드립니다.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-primary hover:scale-[1.02] transition"
              >
                무료로 시작하기 <Rocket className="size-4" />
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-6 py-3.5 text-sm font-medium text-white hover:bg-white/20 transition border border-white/20"
              >
                도입 상담 받기
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 py-12">
      <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-brand grid place-items-center">
            <Sparkles className="size-3 text-white" />
          </div>
          <span className="font-display font-semibold text-foreground">로이어드 Loyard</span>
          <span>© 2026</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-foreground">이용약관</a>
          <a href="#" className="hover:text-foreground">개인정보처리방침</a>
          <a href="#" className="hover:text-foreground">고객지원</a>
        </div>
      </div>
    </footer>
  );
}
