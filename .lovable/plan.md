# 로이어드 업그레이드 기획서

lawygo 리포 분석 결과, 잘 구축된 **Supabase 기반 인증 + 프로필 + 회사 단위 멀티테넌시 + 감사로그** 패턴이 핵심 자산입니다. 현재 로이어드는 정적 랜딩 + Mock 대시보드 상태이므로, 이 패턴을 차용해 단계적으로 SaaS 형태로 끌어올리는 것을 권장합니다.

---

## 1. lawygo에서 그대로 배울 만한 패턴

| 영역 | lawygo 구현 | 로이어드 적용 포인트 |
|---|---|---|
| 인증 | Supabase Email + Google OAuth 단일 로그인 페이지 | `/auth` 페이지 신설, 동일 UX |
| 프로필 | `profiles` (auth.users 1:1, `management_number` 필수) | 자영업자 = "매장번호(#ZA-…)"를 management_number로 |
| 멀티테넌시 | `management_number` 기준 RLS (같은 회사끼리 조회) | 매장 단위로 멤버/직원이 동일 워크스페이스 공유 |
| 게이트웨이 | `/workspace` 진입 시 프로필 미설정 → `ProfileSetupForm` | 첫 로그인 시 매장 정보 온보딩 |
| 감사로그 | `drive_file_audit` (action enum + metadata jsonb) | SNS 발행/AI 생성/세션 재인증 등 모든 액션 audit |
| 외부 리소스 레지스트리 | `drive_folder_registry` | `sns_channel_registry` (Instagram/Naver 채널 메타) |

---

## 2. 로이어드 업그레이드 단계 (3 Phase)

### Phase 1 — 인증 & 회원관리 (최우선 추천)
1. **Lovable Cloud 활성화** (Supabase 백엔드 자동 프로비저닝)
2. `/auth` 페이지: Email/Password + **Google 소셜 로그인** (lawygo `login.tsx` 그대로 차용)
3. `_authenticated` 가드 도입 → `/admin`을 보호 라우트로 이동
4. 랜딩의 "시작하기" → 미로그인이면 `/auth`, 로그인 상태면 `/admin`
5. 로그아웃 / 세션 표시 UI (상단 GNB 우측)

### Phase 2 — 멀티테넌시 & 온보딩
1. `profiles` 테이블 (id, email, display_name, **store_code** (=관리번호), business_name, sns_channels jsonb)
2. RLS: 본인 + 같은 store_code 멤버 조회 허용 (lawygo 패턴 동일)
3. `user_roles` 테이블 + `has_role()` 시큐리티 데피너 함수 (owner / staff / admin 분리 — lawygo에는 없는 보강 항목)
4. 첫 로그인 시 `StoreOnboardingForm`: 매장명, 업종, 인스타/네이버 핸들 입력
5. 현재 좌측 클라이언트 리스트(Mock 5건) → 실 DB 쿼리로 교체 (admin role만 전체 조회)

### Phase 3 — 핵심 도메인 데이터 모델
| 테이블 | 용도 |
|---|---|
| `content_drafts` | AI 생성 캡션/해시태그/이미지 메타 (status: draft/approved/published) |
| `publish_schedule` | 채널 × 요일 × 시간 슬롯 |
| `sns_sessions` | 채널별 세션 상태 (active / re-auth-required) — lawygo `drive_folder_registry` 패턴 |
| `activity_audit` | 발행/재인증/AI 호출 감사 (lawygo `drive_file_audit` 패턴) |

추가 권장 사항 (lawygo에 없는 보강):
- **`user_roles` 분리 테이블** (절대 profiles에 role 컬럼 두지 않기 — 권한 상승 공격 방지)
- **Resend 연동**으로 재인증 알림 메일 (카톡 알림톡 도입 전 임시 대체)
- **AI 콘텐츠 생성은 Lovable AI Gateway** (Gemini) 사용 — 별도 API 키 불필요

---

## 3. 이번 턴에 구현 추천 범위

가장 임팩트 크고 안전한 **Phase 1 전체** 구현을 권장합니다:
- Lovable Cloud 활성화
- `/auth` 페이지 (Email + Google) 신설 — 로이어드 브랜드(네이비/크림슨) 톤 적용
- `_authenticated` 라우트 가드 + `/admin` 이동
- 랜딩 "시작하기" 동작 분기 (로그인 여부)
- GNB에 로그인 상태/로그아웃 표시

Phase 2·3는 별도 턴에서 DB 마이그레이션과 함께 진행.

---

## 4. 기술 메모 (개발진용)

- Stack: TanStack Start (기존 그대로) + Lovable Cloud(Supabase)
- Google OAuth: Lovable Cloud Auth Providers에서 Google 활성화 — 별도 OAuth 앱 등록 불필요
- 라우트: `src/routes/auth.tsx`, `src/routes/_authenticated/route.tsx`, `src/routes/_authenticated/admin.tsx`로 이동
- 세션 훅: `supabase.auth.onAuthStateChange` 루트 1개만 등록 (lawygo 동일 패턴)

---

**진행 여부 확인:** 위 Phase 1을 바로 구현할까요, 아니면 Phase 1+2를 함께 구현할까요?