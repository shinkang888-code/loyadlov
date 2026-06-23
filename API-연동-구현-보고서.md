# AI · 미디어 API 연동 구현 보고서

관리자 콘솔에서 운영에 필요한 모든 AI/미디어 API 키를 입력·등록·검증하고, Gemini·ChatGPT·Higgsfield·Figma·Canva 연동을 추가했습니다.

## 1. 핵심 설계: "환경변수처럼 동작하는" 중앙 시크릿 저장소

Vercel 서버리스에서는 런타임에 환경변수를 영구적으로 쓸 수 없습니다. 그래서 기존
`platformSecrets` 패턴(이미 OAuth/Stripe 등에 사용 중)을 그대로 확장했습니다.

- 입력값은 `app_settings.platform_secrets`(DB)에 저장됩니다.
- 런타임 조회는 **Vercel 환경변수 → DB** 순서 (`resolvePlatformSecret`).
- 즉, 관리자 콘솔에서 등록/변경하면 **재배포 없이 환경변수처럼 즉시 반영**됩니다.

추가된 시크릿 필드 (`src/lib/platformSecrets.server.ts`):

| 필드 | 환경변수 | 용도 |
|---|---|---|
| `geminiApiKey` | `GEMINI_API_KEY` | Google Gemini 텍스트 생성 |
| `openaiApiKey` | `OPENAI_API_KEY` | OpenAI(ChatGPT) 텍스트 생성 |
| `higgsfieldApiKey` | `HIGGSFIELD_API_KEY` | Higgsfield Key ID |
| `higgsfieldSecret` | `HIGGSFIELD_SECRET` | Higgsfield Secret |
| `falKey` | `FAL_KEY` | fal.ai (후속) |
| `figmaToken` | `FIGMA_TOKEN` | Figma REST 토큰 |
| `canvaApiKey` | `CANVA_API_KEY` | Canva 액세스 토큰 |

## 2. 관리자 콘솔 API 연동 패널

- `src/components/AIIntegrationsPanel.tsx`
- 위치: **관리자 콘솔 → 설정 & API → "AI & 앱" 단계** 내에 임베드.
- 기능: 모든 키 입력칸 + "모든 API 키 저장(등록/변경)" 버튼 + 프로바이더별 **연결 테스트**
  + 저장 여부 마스킹 표시(`••••1234`) + 상태 요약.
- 권한: owner/admin만 변경 가능(`canManagePlatformSettings`).

## 3. 프로바이더 연동 (`src/lib/integrations/`)

| 모듈 | 내용 |
|---|---|
| `gemini.server.ts` | Generative Language API. 텍스트 생성 + 연결 테스트(모델 목록) |
| `openai.server.ts` | Chat Completions. 텍스트 생성 + 연결 테스트(모델 목록) |
| `higgsfield.server.ts` | **공식 `@higgsfield/client` SDK** 래퍼. 이미지/영상 생성 + 테스트 |
| `figma.server.ts` | REST(`X-Figma-Token`). 연결 테스트 + 노드→이미지 내보내기 |
| `canva.server.ts` | Connect API 토큰 검증 |
| `llm.server.ts` | Lovable/Gemini/OpenAI 통합 텍스트 게이트웨이 |

### 피그마/캔바 CLI 연동 확인 결과
- **Figma**: "Figma CLI"(`@figma/code-connect`)는 디자인→코드 매핑 전용이라 콘텐츠
  자동화엔 부적합. 대신 **REST API + Personal Access Token** 으로 자산 내보내기를
  구현했습니다. ✅ 추가 완료.
- **Canva**: "Canva CLI"(`@canva/cli`)는 Canva *앱* 개발용. 콘텐츠 자동화는 **Connect
  API(OAuth 2.0 + PKCE)** 가 필요합니다. 따라서 액세스 토큰 **저장/검증**까지 구현하고,
  전체 OAuth 인가 플로우는 후속 단계로 명시했습니다. ⚠️ 부분 구현.

### Higgsfield 주의점
공식 생성 엔드포인트(`POST /jobs/*`)는 DataDome 봇 차단이 걸려 직접 REST 호출 시 403이
발생합니다. 그래서 봇 차단을 우회하도록 설계된 **공식 server-side SDK**(`KEY_ID:KEY_SECRET`
인증)를 사용합니다.

## 4. 미디어 생성 스튜디오 (end-to-end)

- 마이그레이션 `supabase/migrations/20260623010000_media_integrations.sql`
  - `generation_jobs.job_type` 에 `media_gen` 추가
  - `media_assets` 테이블(RLS 포함) 신설
- `jobProcessor.server.ts` → `processMediaGenJob` (Higgsfield 호출 → `media_assets` 저장)
- 서버 함수 `src/lib/aiIntegrations.functions.ts`: 상태/테스트/통합 텍스트 생성/미디어 큐/잡 폴링/갤러리
- UI `src/components/MediaStudioPanel.tsx`: 워크스페이스 **"미디어 스튜디오"** 탭. 이미지/영상
  프롬프트 생성 + 진행률 폴링 + 생성 갤러리.

## 5. 배포 체크리스트

1. Supabase에 새 마이그레이션 2개 적용 (`campaign`, `media_integrations`).
2. Vercel 자동 배포(푸시 시). 키는 환경변수 없이 관리자 콘솔에서 입력 가능.
3. 관리자 콘솔 → 설정 & API → 키 입력 → "연결 테스트"로 검증.

## 6. 빌드

`npm run build` 통과 (exit 0). `@higgsfield/client` 서버 번들 포함 확인.
