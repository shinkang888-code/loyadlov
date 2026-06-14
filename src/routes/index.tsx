import { createFileRoute } from "@tanstack/react-router";
import {
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
  Star,
} from "lucide-react";
import hero from "@/assets/hero.jpg";
import showcase1 from "@/assets/showcase-1.jpg";
import showcase2 from "@/assets/showcase-2.jpg";
import showcase3 from "@/assets/showcase-3.jpg";
import owner from "@/assets/owner.jpg";
import logo from "@/assets/loyard-logo.jpg.asset.json";

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
      { property: "og:image", content: logo.url },
    ],
  }),
  component: Landing,
});

function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="로이어드 Loyard"
      className={`${className} rounded-xl object-cover ring-1 ring-primary/15 shadow-soft`}
    />
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Nav />
      <Hero />
      <LogoStrip />
      <Features />
      <Showcase />
      <Workflow2 />
      <Dashboard />
      <Testimonials />
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
        <div className="glass rounded-full px-4 py-2.5 flex items-center justify-between shadow-soft">
          <a href="#" className="flex items-center gap-2.5">
            <LogoMark className="size-9" />
            <div className="leading-none">
              <div className="font-display font-bold tracking-tight text-base">로이어드</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">Loyard</div>
            </div>
          </a>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">기능</a>
            <a href="#showcase" className="hover:text-foreground transition">사례</a>
            <a href="#workflow" className="hover:text-foreground transition">작동방식</a>
            <a href="#pricing" className="hover:text-foreground transition">요금</a>
            <a href="/admin" className="hover:text-foreground transition">Admin</a>
          </nav>
          <a
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-navy hover:opacity-90 transition"
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
      <div className="absolute inset-0 grid-bg opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />

      {/* Floating logo accents */}
      <div className="hidden md:block absolute top-32 left-[6%] animate-float">
        <LogoMark className="size-16 rotate-[-8deg]" />
      </div>
      <div className="hidden md:block absolute top-56 right-[8%] animate-float" style={{ animationDelay: "1.5s" }}>
        <LogoMark className="size-20 rotate-[6deg]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs text-muted-foreground mb-7 shadow-soft">
            <span className="size-1.5 rounded-full bg-accent animate-pulse" />
            AI × 전담 크루가 함께 운영하는 SNS 피드 SaaS
          </div>
          <h1 className="font-display text-5xl md:text-7xl lg:text-[5.5rem] font-bold leading-[1.02] tracking-tight text-foreground">
            콘텐츠는 <span className="text-crimson">AI</span>가,
            <br />
            운영은 <span className="text-brand-gradient">로이어드</span>가.
          </h1>
          <p className="mt-7 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            자영업자를 위한 단 하나의 SNS 자동화 플랫폼.
            <br className="hidden md:block" />
            인스타 · 틱톡 · 네이버 · 카카오 피드를 매일 자동 생성하고 발행합니다.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#cta"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-navy hover:scale-[1.02] transition"
            >
              무료로 채널 연동하기 <ArrowRight className="size-4" />
            </a>
            <a
              href="#showcase"
              className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-6 py-3.5 text-sm font-medium text-foreground hover:bg-secondary transition shadow-soft"
            >
              실제 생성 사례 보기
            </a>
          </div>

          <div className="mt-10 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="size-3.5 fill-accent text-accent" />
                ))}
              </div>
              <span>4.9 / 자영업자 1,800+ 신뢰</span>
            </div>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">첫 7일 무료 운영</span>
          </div>
        </div>

        <div className="relative mt-20 md:mt-24 mx-auto max-w-5xl">
          <div className="absolute -top-6 -left-6 z-10 hidden md:flex items-center gap-2 bg-card rounded-2xl shadow-card border border-border px-4 py-3">
            <LogoMark className="size-9" />
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Today</div>
              <div className="text-sm font-display font-semibold">12개 피드 자동 발행됨</div>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 z-10 hidden md:flex items-center gap-3 bg-card rounded-2xl shadow-card border border-border px-4 py-3">
            <div className="size-9 rounded-xl bg-accent-gradient grid place-items-center shadow-crimson">
              <Bot className="size-4 text-accent-foreground" />
            </div>
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">AI Generator</div>
              <div className="text-sm font-display font-semibold">실시간 콘텐츠 생성 중…</div>
            </div>
          </div>
          <div className="relative rounded-3xl overflow-hidden border border-border shadow-card bg-card">
            <img src={hero} alt="AI 콘텐츠 신경망 시각화" width={1920} height={1280} className="w-full h-auto" />
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
    <section className="py-14 border-y border-border bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-muted-foreground mb-8">
          공식 연동 채널
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-6 text-foreground/70">
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
    { icon: Bot, title: "업종별 학습된 AI 본문", desc: "요식업·뷰티·리테일 등 업종별 톤앤매너로 GPT·Claude가 본문 + 해시태그 5조합을 동시 출력합니다." },
    { icon: ImageIcon, title: "실사풍 이미지·영상 생성", desc: "Midjourney·SD·Sora 템플릿으로 매장 컨셉에 맞춘 콘텐츠 비주얼을 자동 빌드합니다." },
    { icon: Send, title: "원클릭 다채널 배포", desc: "공식 Partner API와 Headless 자동화를 병행해 안전하게 인스타·틱톡·네이버에 동시 발행합니다." },
    { icon: Cloud, title: "구글드라이브 자동 백업", desc: "/UID_상호명/연-월_콘텐츠/ 구조로 모든 결과물을 사장님 드라이브에 자동 정리합니다." },
    { icon: ShieldCheck, title: "계정 차단 방지 설계", desc: "Stealth 플러그인 + 지역 기반 주거용 프록시로 소중한 마케팅 계정을 안전하게 운영합니다." },
    { icon: Workflow, title: "전담 크루 매니저", desc: "UID 발급과 동시에 전담 크루가 배정되어 콘텐츠 승인, 일정, 보고까지 책임집니다." },
  ];

  return (
    <section id="features" className="py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.25em] text-crimson font-semibold mb-3">FEATURES</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            매장이 바쁠수록,
            <br />
            <span className="text-brand-gradient">SNS는 더 잘 굴러갑니다.</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-lg">
            로이어드는 AI 생성 엔진과 전담 운영 크루가 한 팀으로 움직이는 하이브리드 SaaS입니다.
          </p>
        </div>

        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((it, idx) => (
            <div
              key={it.title}
              className="group relative rounded-3xl bg-card border border-border p-7 hover:shadow-card hover:-translate-y-1 transition overflow-hidden"
            >
              <div
                className={`size-12 rounded-2xl grid place-items-center mb-5 shadow-soft ${
                  idx % 2 === 0 ? "bg-brand text-primary-foreground" : "bg-accent-gradient text-accent-foreground"
                }`}
              >
                <it.icon className="size-5" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground">{it.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{it.desc}</p>
              <div className="absolute top-5 right-5 text-[10px] font-mono text-muted-foreground/60">
                0{idx + 1}
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
    <section id="showcase" className="py-28 md:py-36 relative bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs uppercase tracking-[0.25em] text-crimson font-semibold mb-3">SHOWCASE</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            사장님은 영업만,
            <br />
            <span className="text-brand-gradient">피드는 알아서 빛납니다.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-12 gap-5">
          <div className="md:col-span-7 relative rounded-3xl overflow-hidden border border-border group shadow-card">
            <img src={showcase2} alt="미나리 삼겹살 콘텐츠" loading="lazy" width={1080} height={1600} className="w-full h-[520px] object-cover group-hover:scale-105 transition duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
            <div className="absolute top-5 left-5 flex items-center gap-2 bg-card/95 backdrop-blur rounded-full px-3 py-1.5">
              <LogoMark className="size-5" />
              <span className="text-xs font-semibold text-foreground">Loyard Auto-Generated</span>
            </div>
            <div className="absolute bottom-0 left-0 p-8 text-white">
              <p className="text-xs uppercase tracking-widest text-white/70 mb-2">요식업 · 미나리삼겹살</p>
              <h3 className="font-display text-2xl md:text-3xl font-bold leading-tight">
                "감성 식당 톤"으로 매일 1피드
                <br />
                자동 발행 중
              </h3>
            </div>
          </div>
          <div className="md:col-span-5 grid grid-rows-2 gap-5">
            <div className="relative rounded-3xl overflow-hidden border border-border group shadow-card">
              <img src={showcase1} alt="인스타그램 피드 자동 생성" loading="lazy" width={1280} height={1280} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6 text-white">
                <p className="text-xs uppercase tracking-widest text-white/70 mb-1">INSTAGRAM</p>
                <h4 className="font-display text-lg font-semibold">피드 + 릴스 동시 생성</h4>
              </div>
            </div>
            <div className="relative rounded-3xl overflow-hidden border border-border group shadow-card">
              <img src={owner} alt="자영업 사장님" loading="lazy" width={1080} height={1500} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/85 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6 text-white">
                <p className="text-xs uppercase tracking-widest text-white/70 mb-1">CAFE · 카페</p>
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
      <div className="absolute inset-0 grid-bg opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="max-w-2xl mb-16">
          <p className="text-xs uppercase tracking-[0.25em] text-crimson font-semibold mb-3">HOW IT WORKS</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            가입부터 발행까지
            <br />
            <span className="text-brand-gradient">단 4단계.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <div key={s.n} className="relative rounded-3xl bg-card border border-border p-7 hover:shadow-card hover:-translate-y-1 transition">
              <div className="font-display text-5xl font-bold text-brand-gradient">{s.n}</div>
              <h3 className="mt-4 font-display text-xl font-semibold text-foreground">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 size-6 rounded-full bg-card border border-border grid place-items-center shadow-soft">
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
    <section className="py-28 md:py-36 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-crimson font-semibold mb-3">CONTROL CENTER</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              운영 크루를 위한
              <br />
              <span className="text-brand-gradient">AI 콘트롤 센터.</span>
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
                  <div className="mt-0.5 size-5 rounded-full bg-brand grid place-items-center shrink-0 shadow-soft">
                    <Check className="size-3 text-primary-foreground" />
                  </div>
                  <span className="text-foreground/80">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute -top-5 -left-5 z-10 bg-card rounded-2xl shadow-card border border-border px-4 py-3 flex items-center gap-2">
              <LogoMark className="size-9" />
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Workspace</div>
                <div className="text-sm font-display font-semibold">#ZA-2026-0917</div>
              </div>
            </div>
            <div className="relative rounded-3xl overflow-hidden border border-border animate-float shadow-card bg-card">
              <img src={showcase3} alt="관리자 대시보드" loading="lazy" width={1600} height={1200} className="w-full h-auto" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const items = [
    { q: "직원 한 명 더 뽑은 효과예요. 매장 운영에만 집중해도 인스타가 알아서 돌아갑니다.", a: "김지훈 사장", b: "미나리삼겹살 · 성수점" },
    { q: "사진 한 장 안 찍어도 매주 릴스가 올라가요. AI라는 게 안 보일 만큼 자연스러워요.", a: "이수연 대표", b: "카페 안온 · 합정" },
    { q: "지점 6개를 한 명이 관리해요. 본사 톤으로 통일된 피드, 이게 진짜 시스템입니다.", a: "박민호 본부장", b: "F&B 프랜차이즈" },
  ];
  return (
    <section className="py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs uppercase tracking-[0.25em] text-crimson font-semibold mb-3">TESTIMONIALS</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            1,800명의 사장님이
            <br />
            <span className="text-brand-gradient">선택한 이유.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {items.map((it) => (
            <figure key={it.a} className="rounded-3xl bg-card border border-border p-7 shadow-soft hover:shadow-card transition">
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => <Star key={i} className="size-4 fill-accent text-accent" />)}
              </div>
              <blockquote className="font-display text-lg leading-snug text-foreground">"{it.q}"</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <LogoMark className="size-9" />
                <div>
                  <div className="text-sm font-semibold text-foreground">{it.a}</div>
                  <div className="text-xs text-muted-foreground">{it.b}</div>
                </div>
              </figcaption>
            </figure>
          ))}
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
      features: ["매일 콘텐츠 자동 생성", "4개 채널 동시 발행 (IG·TT·NV·KK)", "실사풍 이미지 + 영상 생성", "지역 기반 프록시 안전 발행", "월간 성과 리포트"],
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
    <section id="pricing" className="py-28 md:py-36 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs uppercase tracking-[0.25em] text-crimson font-semibold mb-3">PRICING</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            매장 규모에 맞춰,
            <br />
            <span className="text-brand-gradient">합리적으로.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-3xl p-8 border transition ${
                p.highlight
                  ? "bg-brand text-primary-foreground border-primary shadow-navy"
                  : "bg-card border-border hover:shadow-card"
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent-gradient text-accent-foreground rounded-full px-3 py-1 text-xs font-semibold shadow-crimson">
                  Most Popular
                </div>
              )}
              <h3 className="font-display text-xl font-semibold">{p.name}</h3>
              <p className={`text-sm mt-1 ${p.highlight ? "text-white/75" : "text-muted-foreground"}`}>{p.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold">{p.price}</span>
                <span className={p.highlight ? "text-white/70" : "text-muted-foreground"}>{p.period}</span>
              </div>
              <ul className="mt-7 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className={`size-4 mt-0.5 shrink-0 ${p.highlight ? "text-white" : "text-crimson"}`} />
                    <span className={p.highlight ? "text-white/90" : "text-foreground/80"}>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#cta"
                className={`mt-8 w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${
                  p.highlight
                    ? "bg-white text-primary hover:bg-white/90"
                    : "bg-foreground text-background hover:opacity-90"
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
        <div className="relative rounded-[2.5rem] overflow-hidden bg-brand p-12 md:p-20 text-center shadow-navy">
          <div className="absolute inset-0 grid-bg opacity-15" />
          <div className="absolute -top-24 -right-24 size-96 rounded-full bg-accent/30 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center justify-center mb-6">
              <LogoMark className="size-14 ring-2 ring-white/30" />
            </div>
            <h2 className="font-display text-4xl md:text-6xl font-bold text-primary-foreground tracking-tight leading-tight">
              오늘부터 SNS는
              <br />
              로이어드에게 맡기세요.
            </h2>
            <p className="mt-5 text-white/75 text-lg max-w-xl mx-auto">
              5분 채널 연동, 즉시 전담 크루 배정. 첫 7일은 무료로 운영해 드립니다.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-full bg-accent-gradient px-6 py-3.5 text-sm font-bold text-accent-foreground shadow-crimson hover:scale-[1.02] transition"
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
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-8" />
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
