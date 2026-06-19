# 로이어드(Loyard) 확장 개발명세서

> 작성일: 2026-06-19  
> 대상 리포: `loyad-dcb9af70`  
> 목표: Mock/미완성 기능을 실동작 SaaS 수준으로 완성

---

## 1. 현황 분석 요약

### 1.1 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | TanStack Start + React 19 + TanStack Router |
| UI | Tailwind CSS 4 + shadcn/ui (Radix Dialog 등) |
| 백엔드 | TanStack Server Functions + Supabase |
| 배포 | Vercel (Nitro preset) |
| AI | Lovable AI Gateway |

### 1.2 구현 완료 (동작 가능)

- Supabase Auth (Email + Google)
- 매장 온보딩 (`store_code` 필수)
- 4플랫폼 OAuth 백엔드 (Instagram, Threads, YouTube, Naver Blog)
- 소셜 계정 CRUD + 토큰 AES-256-GCM 암호화
- 콘텐츠 작성·즉시/예약 발행·재시도
- AI 캡션 생성, Google Drive 소재함, 상담 리드 DB 연동

### 1.3 미완성 / 동작 불가 항목

| # | 기능 | 문제 | 우선순위 |
|---|------|------|----------|
| 1 | **채널 OAuth 연결하기 버튼** | `<a href>` 탭 이동만 수행, API 입력 팝업 없음. OAuth 버튼은 credentials 미설정 시 disabled | **P0** |
| 2 | OAuth 설정 UI 분산 | `settings` 탭에만 API 입력 폼 존재, 워크스페이스 AI 패널과 UX 단절 | **P0** |
| 3 | YouTube OAuth 설정 | env 변수만 지원, Meta/Naver처럼 DB 저장 UI 없음 | **P1** |
| 4 | 네이버 token exchange | `redirect_uri` 파라미터 누락 → OAuth 콜백 실패 가능 | **P1** |
| 5 | YouTube 토큰 갱신 | `localhost` redirect URI 고정 → 프로덕션 refresh 실패 | **P1** |
| 6 | 예약 발행 Cron | API만 존재, `vercel.json` cron 미설정 | **P1** |
| 7 | 클라이언트 목록 | Mock 5건 하드코딩, DB 미연동 | P2 |
| 8 | 생성 큐 / 최근 활동 | 정적 Mock 데이터 | P2 |
| 9 | queue / members / analytics 탭 | 전용 화면 없음 → workspace fallback | P2 |
| 10 | TikTok / Kakao | 랜딩 UI만, OAuth/발행 없음 | P3 |

---

## 2. Phase 1 — 채널 OAuth UX 완성 (이번 스프린트)

### 2.1 목표

"채널 OAuth 연결하기" 클릭 시 **Dialog 팝업**이 열리고, API 자격증명 입력 → 저장 → 플랫폼 OAuth 연결까지 **한 흐름**으로 완료.

### 2.2 UI/UX 명세

#### 진입점

1. **AI 보조 패널** — "채널 세션 상태" 카드 하단 버튼
2. **채널 세션 탭** — OAuth 버튼 disabled 클릭 시
3. **URL 파라미터** — `/admin?tab=channels&setup=oauth` 자동 오픈

#### Dialog 구조 (2단계)

```
┌─────────────────────────────────────────┐
│  채널 OAuth 연결                    [X] │
├─────────────────────────────────────────┤
│  [1. API 설정]  [2. 계정 연결]          │
│                                         │
│  Meta (Instagram/Threads)               │
│  ┌ App ID ─────────────────────────┐   │
│  └ App Secret ────────────────────┘   │
│                                         │
│  YouTube (Google OAuth)                 │
│  ┌ Client ID ──────────────────────┐   │
│  └ Client Secret ─────────────────┘   │
│                                         │
│  네이버 블로그                           │
│  ┌ Client ID ──────────────────────┐   │
│  └ Client Secret ─────────────────┘   │
│                                         │
│  [설정 저장]                             │
├─────────────────────────────────────────┤
│  Meta (IG+Threads)  [연결하기]          │
│  YouTube            [연결하기]          │
│  네이버 블로그       [연결하기]          │
│                                         │
│  ※ env 변수도 지원 (DB 우선, env fallback)│
└─────────────────────────────────────────┘
```

#### 버튼 표시 조건 변경

- **Before:** `accounts.length === 0` 일 때만 CTA 표시
- **After:** 4플랫폼 중 **하나라도 미연결**이면 CTA 표시

### 2.3 신규/수정 파일

| 파일 | 역할 |
|------|------|
| `src/components/ChannelOAuthConnectDialog.tsx` | OAuth 설정+연결 Dialog (신규) |
| `src/lib/social/youtubeOAuthSettings.ts` | YouTube credentials DB 저장 (신규) |
| `src/lib/googleOAuth.server.ts` | DB credentials 지원 |
| `src/lib/social.functions.ts` | `saveYouTubeOAuthSettingsFn` 추가 |
| `src/routes/_authenticated/admin.tsx` | Dialog 연동, 버튼 조건 수정 |
| `src/components/SocialPublishPanel.tsx` | disabled OAuth → Dialog 트리거 |
| `src/components/OAuthSettingsPanel.tsx` | YouTube 입력 필드 추가 |

### 2.4 API / Server Function

```typescript
// 추가
saveYouTubeOAuthSettingsFn({ settings: { clientId, clientSecret, enabled } })

// getOAuthSettingsFn 응답 확장
youtube: { configured: boolean, source: "env" | "db" | "none" }
```

---

## 3. Phase 2 — OAuth 백엔드 버그 수정 (이번 스프린트 포함)

### 3.1 네이버 token exchange

`exchangeNaverCode()`에 `redirect_uri` 추가:

```typescript
redirect_uri: getNaverRedirectUri(origin),
```

### 3.2 YouTube 토큰 갱신

`tokenRefreshService.ts`:

```typescript
// Before
getYouTubeRedirectUri("https://localhost")
// After
getYouTubeRedirectUri(process.env.APP_URL?.trim() || "https://localhost")
```

### 3.3 Vercel Cron

`vercel.json`:

```json
"crons": [{
  "path": "/api/cron/social-publish",
  "schedule": "*/15 * * * *"
}]
```

Cron 인증: `Authorization: Bearer {CRON_SECRET}`

---

## 4. Phase 3 — Mock → 실데이터 전환 (후속 스프린트)

### 4.1 클라이언트(매장) 목록

- `profiles` + `store_code` 기반 실제 매장 목록 조회
- admin role만 전체 매장 조회 (RLS + `user_roles`)

### 4.2 생성 큐

- Redis 또는 Supabase `job_queue` 테이블
- AI 이미지/영상 생성 작업 상태 실시간 반영

### 4.3 미구현 탭

| 탭 | 구현 방향 |
|----|-----------|
| queue | `content_drafts` + 작업 큐 UI |
| members | `profiles` + `user_roles` CRUD |
| analytics | `social_posts` 발행 통계 차트 |

### 4.4 sns_sessions 테이블

`.lovable/plan.md` Phase 3 — 채널별 세션 상태 (`active` / `re-auth-required`)

---

## 5. 환경 변수 체크리스트

### 필수 (프로덕션)

| 변수 | 용도 |
|------|------|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | DB/Auth |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | 클라이언트 |
| `APP_URL` | OAuth callback base URL |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | 토큰 암호화 (32바이트) |
| `CRON_SECRET` | Cron 인증 |

### 플랫폼 OAuth (env 또는 Dialog DB 입력)

| 변수 | 플랫폼 |
|------|--------|
| `META_APP_ID`, `META_APP_SECRET` | Instagram + Threads |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | YouTube |
| `NAVER_OAUTH_CLIENT_ID`, `NAVER_OAUTH_CLIENT_SECRET` | 네이버 블로그 |

### 선택

| 변수 | 용도 |
|------|------|
| `LOVABLE_API_KEY` | AI 캡션/이미지 |
| `OAUTH_STATE_SECRET` | OAuth state HMAC |
| `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Drive 소재함 |

---

## 6. 테스트 시나리오

### 6.1 OAuth Dialog (P0)

- [ ] AI 패널 "채널 OAuth 연결하기" → Dialog 오픈
- [ ] Meta/YouTube/Naver credentials 입력 → 저장 toast
- [ ] 저장 후 OAuth "연결하기" 버튼 활성화
- [ ] Meta OAuth → Instagram + Threads 계정 연결
- [ ] 부분 연결 상태에서도 CTA 버튼 표시

### 6.2 OAuth 백엔드 (P1)

- [ ] 네이버 OAuth callback 성공
- [ ] YouTube 토큰 refresh (APP_URL 기준)
- [ ] Cron `/api/cron/social-publish` 15분 주기 실행

### 6.3 회귀

- [ ] 기존 settings 탭 OAuth 설정 저장
- [ ] 워크스페이스 PublishBar 발행
- [ ] 빌드 `npm run build` 성공

---

## 7. 배포 절차

1. `npm run build` 로컬 검증
2. `git commit` — feat: 채널 OAuth Dialog 및 백엔드 버그 수정
3. `git push origin main`
4. Vercel 자동 배포 확인
5. Vercel Dashboard — env 변수 설정 확인
6. Cron Job 활성화 확인

---

## 8. 일정 (권장)

| Phase | 범위 | 기간 |
|-------|------|------|
| **Phase 1** | OAuth Dialog + YouTube DB 설정 | 1일 (이번) |
| **Phase 2** | OAuth 버그 + Cron | 0.5일 (이번) |
| **Phase 3** | Mock → 실데이터 | 3~5일 (후속) |
| **Phase 4** | TikTok/Kakao 연동 | 별도 기획 |

---

*본 명세서는 코드베이스 분석(2026-06-19)을 기반으로 작성되었으며, Phase 1·2는 이번 스프린트에서 즉시 구현합니다.*
