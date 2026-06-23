# 로이어드(Loyard) 확장 개발명세서

> 갱신일: 2026-06-22  
> 대상 리포: `loyad-dcb9af70`  
> Supabase: `canfdcmduhjabrcocxfv`  
> Vercel: `loyad_beta` → https://loyadbeta.vercel.app

---

## 1. 완료 현황 (Phase 1–4)

| 영역 | 상태 |
|------|------|
| Supabase Auth (Email + Google) | ✅ |
| 매장 온보딩 (`store_code`) | ✅ |
| Admin 8탭 실데이터 | ✅ |
| 6플랫폼 OAuth (Meta/YT/Naver/TikTok/Kakao) | ✅ |
| Instagram/Threads/YT/Naver/TikTok 발행 | ✅ |
| Vercel Cron 15분 (`/api/cron/social-publish`) | ✅ |
| AI 텍스트·이미지 (Lovable Gateway) | ✅ |
| TikTok/Kakao OAuth (Phase 4) | ✅ |

---

## 2. Phase 5 — 프로덕션 가동 (2026-06-22 적용)

### 2.1 Kakao 발행

| 항목 | 내용 |
|------|------|
| API | `POST /v2/api/talk/memo/default/send` (talk_message 스코프) |
| 채널 ID | `KAKAO_CHANNEL_PUBLIC_ID` env 또는 설정 탭 DB 저장 |
| OAuth | `profile_nickname,talk_message` 스코프 추가 |
| 제한 | 구독자 대량 발송(친구톡)은 Kakao BizMessage — Phase 7 |

**파일:** `src/lib/social/kakaoPublisher.ts`, `kakaoOAuth.ts`, `kakaoOAuthSettings.ts`

### 2.2 Admin UX

- 워크스페이스: 샘플 본문 제거 → 최신 드래프트 자동 로드 / 새 콘텐츠 버튼
- 본문 클립보드 복사
- `.env.example` Google Drive·Kakao 채널·CRON 키 문서화

### 2.3 필수 Vercel env (Production)

```
SUPABASE_* / VITE_SUPABASE_*  (설정됨)
APP_URL=https://loyadbeta.vercel.app
LOVABLE_API_KEY=
CRON_SECRET=          # openssl rand -hex 32
SOCIAL_TOKEN_ENCRYPTION_KEY=
KAKAO_CHANNEL_PUBLIC_ID=
(+ 각 플랫폼 OAuth 키)
```

### 2.4 Admin 역할 SQL

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('YOUR_AUTH_USER_UUID', 'admin')
ON CONFLICT DO NOTHING;
```

---

## 3. Phase 6 — 콘텐츠 고도화 (2026-06-22 적용)

| 기능 | 파일 | 상태 |
|------|------|------|
| AI 숏폼 스토리보드 | `src/lib/video.functions.ts` | ✅ |
| VideoTab UI 연동 | `admin.tsx` VideoTab | ✅ |
| AI 영상 렌더 (Runway/Sora) | `RUNWAY_API_KEY` | 🔜 Phase 7 |
| 톤 프로필 DB 전용 테이블 | — | 🔜 (현재 `profiles.sns_channels` 파싱) |

---

## 4. Phase 7 — SaaS 수익화 (예정)

- Stripe Standard/Premium
- `subscriptions` / `usage_logs` 테이블
- Kakao BizMessage 친구톡 연동
- 외부 SNS 성과 API (Meta Insights, YT Analytics)

---

## 5. Phase 8 — 운영 자동화 (예정)

- 주간 리포트 이메일
- 발행 실패 Slack/카카오 알림
- A/B 캡션 성과 비교

---

## 6. 기술 부채

| 항목 | 우선순위 |
|------|----------|
| `createServerFn().inputValidator()` → `.validator()` | P2 |
| `sns_sessions` 테이블 미사용 정리 | P3 |
| Admin dynamic import (번들 500kB+) | P3 |
| Vitest + Playwright E2E | P2 |

---

## 7. 검증 체크리스트

- [ ] Vercel env 전체 설정 후 재배포
- [ ] Meta 1계정 OAuth → Instagram 즉시 발행
- [ ] Kakao: 채널 Public ID + talk_message 재연결 → memo 발행
- [ ] AI 본문 생성 (LOVABLE_API_KEY)
- [ ] Cron: `Authorization: Bearer $CRON_SECRET` → `/api/cron/social-publish`
