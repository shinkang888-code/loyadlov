# Loyadlov 특허 페이즈 — 인간 개입 대기목록

자동 구현 완료된 페이즈(①~⑧) 외, **운영자/사용자 확인이 필요한** 항목입니다.

## 🔴 배포 전 필수 (P0)

| ID | 항목 | 담당 | 작업 |
|----|------|------|------|
| H-01 | **Neon DB 마이그레이션 적용** | ✅ 완료 | `002_tenant_rls.sql` 적용됨 — `node scripts/verify-neon-migration.mjs` 로 검증 |
| H-02 | **CRON_SECRET 설정** | ✅ 완료 | Vercel Production/Development 추가 — **재배포 후 cron 활성** |
| H-03 | **SOCIAL_TOKEN_ENCRYPTION_KEY** | ✅ 완료 | Vercel Production/Development 추가 — **재배포 후 신규 토큰 암호화 적용** |

## 🟠 플랫폼 연동 (P1)

| ID | 항목 | 담당 | 작업 |
|----|------|------|------|
| H-04 | **Meta OAuth 앱** | 사용자 | Facebook Developer → Instagram/Threads 권한, Redirect URI `https://loyadlov.vercel.app/api/social/meta/oauth/callback` |
| H-05 | **Google/YouTube OAuth** | 사용자 | Google Cloud Console OAuth 클라이언트 + YouTube Data API |
| H-06 | **네이버/카카오/틱톡 OAuth** | 사용자 | 각 플랫폼 개발자 콘솔 앱 등록 및 Admin → API 연동 탭 입력 |
| H-07 | **ThreadBot 자동화 워커** | 🟡 부분 완료 | Vercel Cron `/api/cron/threadbot-worker` (30분) — dry-run/SKIP heartbeat. **Meta 피드 fetch·실제 like/reply는 H-04 OAuth 후 Render 확장** |

## 🟡 인프라 최적화 (P2)

| ID | 항목 | 담당 | 작업 |
|----|------|------|------|
| H-08 | **Postgres RLS 세션 활성화** | 운영 | Neon **connection pooler** + 트랜잭션 내 `SET LOCAL app.current_store_code` — serverless HTTP 드라이버는 세션 유지 불가 → pooler 전환 후 RLS 정책 완전 활성 |
| H-09 | **SSE 타임라인 인증 UX** | 🟡 부분 완료 | `useUnifiedTimeline` SSE 우선 + 폴링 fallback. `/api/timeline/stream` 동작 |
| H-10 | **Neon Auth trusted origins** | 운영 | 프리뷰/커스텀 도메인 추가 시 Neon Console → Auth → Trusted Origins 갱신 |

## 🟢 검증 체크리스트 (배포 후)

- [x] 데모 로그인 → Admin 통합 타임라인 표시 (`scripts/test-demo-login.mjs`)
- [ ] 블로그 원고 생성 → `verificationPassed: true` 시 completed
- [x] 소셜 claim 인터록 → `claim_social_post` 중복 claim 거부 (`scripts/test-social-interlock.mjs`)
- [x] Cron 3종 200 OK (`scripts/test-cron.mjs`)
- [x] ThreadBot cron → dry-run/skip heartbeat (`/api/cron/threadbot-worker`)

---

## 자동 완료된 페이즈 요약

| 페이즈 | 내용 | 주요 파일 |
|--------|------|-----------|
| ① | 디터미니스틱 검수 게이트 | `draftVerification.ts`, `aiCore.server.ts` |
| ② | 테넌트 가드 + RLS 마이그레이션 SQL | `tenant-db.server.ts`, `002_tenant_rls.sql` |
| ③ | 통합 타임라인 | `timeline.functions.ts`, `useUnifiedTimeline.ts`, Admin AiPanel |
| ④ | 발행 인터록 (claim → publish) | `socialPublishService.ts`, `claim_social_post` |
| ⑤ | CLAIMED FSM | `claim_generation_jobs`, `jobProcessor.server.ts` |
| ⑥ | 실시간 폴링 4s + SSE 엔드포인트 | `useUnifiedTimeline.ts`, `/api/timeline/stream` |
| ⑦ | 키워드 경계 매칭 | `textMetrics.ts` |
| ⑧ | ThreadBot SKIP 스트리밍 조기중단 | `gemini.server.ts`, `threadbot.functions.ts` |

마지막 업데이트: 2026-06-28
