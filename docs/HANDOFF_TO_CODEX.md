# Codex 인계 문서 — MINIHUB 1차 개발 (Claude)

작성일: 2026-11-23 · 작업 브랜치: `claude/eager-gauss-nzn2jd` · PR: minho-nim/minially#29
이 문서는 **실제로 구현·검증한 것**과 **계획만 세운 것**을 나눠 적었습니다. 검증 표시가 없는 항목은 검증하지 않은 것입니다.

## 1. 구조
```
(저장소 minho-nim/minially = minihub)
├── minially/   기존 미니어리 전체(웹 + Windows 앱 + Pages Functions). 위치만 옮김, 코드 변경 없음
├── hub/        미니허브 대시보드(React + Vite + Pages Functions)
├── minilog/    미니로그(React + Vite + Pages Functions)
├── shared/
│   ├── server/   로그인·세션(auth), Gemini 호출(ai), 사용량(usage), 표 만들기(schema), 공통 타입(d1)
│   ├── client/   브라우저 fetch 도구·앱 주소(api.ts)
│   ├── ui/       공통 색·글자 토큰(base.css)
│   └── testing/  가짜 Gemini 서버(mock-gemini.mjs)
├── docs/       SETUP_CLOUDFLARE.md(소유자 설정), 이 문서
└── .github/workflows/  deploy-pages·desktop-release·deploy-release(미니어리), hub-minilog-check(신규)
```
- 앱마다 `package.json`·`package-lock.json`이 따로 있습니다(npm workspaces 안 씀). 이유: Windows 앱(electron-builder)이 `minially/node_modules`를 그대로 묶어서, 의존성을 위로 끌어올리면 패키징이 깨질 수 있습니다.
- `shared/`는 외부 패키지를 import하지 않습니다. React 컴포넌트는 공유하지 않습니다(바깥 폴더에서 react를 찾지 못함). 공유하려면 Vite `resolve.dedupe`와 tsconfig `paths`를 같이 맞춰야 합니다.

## 2. 구현 완료(검증함)
| 기능 | 위치 | 검증 |
|---|---|---|
| 미니어리 → `minially/` 이동, 워크플로 경로 수정 | `minially/`, `.github/workflows/*` | lint·build·build:pages·단위 32·데스크톱 20·동기화 13·화면 223 통과 |
| 운영 배포 안전장치(`MINIHUB_LAYOUT_READY`) | `deploy-release.yml` | 변수 설정은 소유자 완료. 워크플로 실제 실행은 아직 안 함 |
| 공통 로그인(미니어리 코드 그대로) + 서버 세션 | `shared/server/auth.ts` | hub·minilog 시험 |
| 세션: 무작위 32바이트 토큰, D1에는 해시만, HttpOnly·SameSite=Lax·(https면)Secure, 30일 | 〃 | 쿠키 확인 |
| 틀린 코드 IP별 10분 20회 제한 | 〃 (`hub_attempts`) | 코드 리뷰만(시험 없음) |
| 앱별 세션 분리(hub 세션은 minilog에서 못 씀) | `sessionFor(..., app)` | 코드 리뷰만 |
| 로그아웃(서버 세션 삭제 + 쿠키 비움), 만료 세션 무효 | 〃 | 시험(로그아웃 후 새로고침해도 로그인 화면) |
| 다른 사이트에서 보낸 상태 변경 요청 거절(Origin 검사) | `sameOrigin` | 시험(다른 Origin 403) |
| 사용자별 Gemini 키(Cloudflare 비밀값 `GEMINI_KEY_C/D`) | `shared/server/ai.ts` | 가짜 Gemini로 시험 |
| Gemini 오류 구분: 키 없음·키 오류·호출 제한(분당)·하루 한도·안전 차단·응답 오류·지연 | 〃 | 호출 제한·한도 초과는 시험, 나머지는 코드 리뷰만 |
| AI 호출 기록(사용자·앱·모델·작업·입력/출력 토큰·성공/오류) | `ai_usage` 표 | 시험(대시보드 숫자) |
| 미니허브 대시보드: 숫자 타일·앱 카드·앱별 사용량 막대/표·계정·Gemini 안내·로그아웃 | `hub/src/App.tsx` | PC 1400·폰 400 가로 넘침 0, 콘솔 오류 0 |
| 미니 가족 디자인: 캐릭터 미니토(방울토마토 SVG), 손글씨 서명 로고, 토마토 서명 색, 앱별 손글씨 글꼴(앱에 내장) | `shared/ui/minito.ts`, `shared/ui/base.css`, `hub/DESIGN.md` | 화면 확인(PC·폰), 시험 통과 |
| 코드 해시 도우미(브라우저 안에서만 계산) | `hub/public/code-hash.html` | 시험(서버 요청 없음) |
| Minoffia 통계 API `GET /api/stats` (Bearer `STATS_API_TOKEN`, 숫자만) | `hub/functions/api/stats.ts` | 시험(토큰 없음·틀림 401, 맞음 200, 키 원문 없음) |
| 미니로그: 원고 목록·새 원고·편집·자동 저장(0.8초)·승인·삭제·발행용 복사 | `minilog/src/App.tsx`, `minilog/functions/` | 시험 |
| 미니로그: 경험 글 → AI 초안(제목·본문·[사진] 위치·해시태그) | `functions/api/drafts/[id]/generate.ts` | 가짜 Gemini로 시험 |
| 사용자별 데이터 분리(모든 쿼리에 `WHERE user = ?`) | `minilog/functions/_drafts.ts` | 시험(D가 C 원고 목록·조회·수정 불가, 비로그인 401) |

## 3. 미완료(계획만)
- **실제 배포 안 됨.** minihub·minilog Cloudflare 프로젝트는 아직 없습니다(`docs/SETUP_CLOUDFLARE.md`). minihub.pages.dev·minilog.pages.dev 주소를 쓸 수 있는지도 확인하지 못했습니다.
- **실제 Gemini 호출 검증 안 됨.** 가짜 서버로만 시험했습니다. 기본 모델 `gemini-2.5-flash`가 지금도 있는지 확인이 필요합니다(`GEMINI_MODEL`로 바꿀 수 있음).
- 미니로그 1단계 남은 것: 사진 다중 업로드(R2 `MINILOG_PHOTOS`)·사진 분석·사진 위치 연결, 개인별 참고 블로그 분석, 게시 완료 URL 기록, 사진 30일 보관(R2 수명 규칙)
- 미니로그 개인 대시보드(호출량·원고 현황·사진 용량·수익)
- 미니로그 2·3단계 전체
- **미니어리 Gemini 연결 안 함.** 미니어리는 아직 AI 기능이 없고, `callGemini`가 `app: 'minially'`를 받을 수 있게만 해 둠
- 추정 비용: `estimated_cost_usd`는 `null`. 모델 단가 표를 정한 뒤 계산
- 미니어리 로그인과 미니허브 세션은 따로입니다(같은 코드지만 미니어리는 기존 방식 그대로, 각 사이트에서 따로 로그인). `*.pages.dev`끼리는 쿠키를 나눌 수 없어서입니다. 하나로 묶으려면 개인 도메인이 필요합니다.
- 저장소 이름 `minihub`로 변경 안 함(Windows 앱 업데이트 주소 때문, 4절)

## 4. 공통 인증 구조
1. 사용자는 **미니어리 로그인 코드**를 입력합니다.
2. 서버는 `normalizeCode`(대소문자·`-` 무시, O→0, I·L→1) → SHA-256 → `USER_CODE_HASHES`(`C:<해시>,D:<해시>`)에서 사용자 이름을 찾습니다. 코드 원문은 저장·기록하지 않습니다.
3. 맞으면 `hub_sessions`에 토큰 해시·사용자·앱·만료를 넣고 `mh_session` 쿠키를 줍니다.
4. API마다 `requireSession(ctx, app)`으로 확인합니다. 세션의 `app`이 다르면 거절합니다.
- 미니어리 동기화는 기존 `SYNC_CODE_HASHES` + Bearer 코드 방식을 **그대로** 씁니다(바꾸지 않음).

## 5. Gemini 연결 방식
- 브라우저 → `POST /api/drafts/:id/generate` → Pages Function → `callGemini()` → `{GEMINI_API_BASE}/v1beta/models/{model}:generateContent` (헤더 `x-goog-api-key`)
- 키는 `env.GEMINI_KEY_{세션의 user}`에서만 꺼냅니다. 응답·로그·D1에 키를 넣지 않습니다.
- 사용자 글은 프롬프트에서 `<경험>` 자료 칸에만 넣고, 그 안의 지시를 따르지 말라고 명시합니다.
- 성공·실패 모두 `ai_usage`에 한 줄 남깁니다(원문 없이 숫자와 오류 종류만).

## 6. Cloudflare 바인딩·환경 변수 이름
| 이름 | 종류 | 쓰는 곳 |
|---|---|---|
| `DB` | D1 바인딩(세 프로젝트 같은 DB) | minially, hub, minilog |
| `SYNC_CODE_HASHES` | 비밀값(기존) | minially |
| `USER_CODE_HASHES` | 비밀값 | hub, minilog |
| `GEMINI_KEY_C`, `GEMINI_KEY_D` | 비밀값 | hub(연결 상태 표시), minilog |
| `STATS_API_TOKEN` | 비밀값 | hub |
| `GEMINI_MODEL` | 변수(선택) | hub, minilog |
| `GEMINI_API_BASE` | **시험 전용**. 운영에는 넣지 않음 | 시험 |
| `MINILOG_PHOTOS` | R2 바인딩(계획) | minilog |
| `MINIHUB_LAYOUT_READY` | GitHub 저장소 변수 | deploy-release.yml |

D1 표: 기존 `sync_meta`·`sync_records`·`sync_shares`·`sync_attempts`(미니어리), 신규 `hub_sessions`·`hub_attempts`·`ai_usage`·`minilog_drafts`(`shared/server/schema.ts`, `CREATE TABLE IF NOT EXISTS`만).

## 7. 실제 배포 상태 (2026-11-23)
- minially.pages.dev: 기존 운영 그대로. Cloudflare Root directory는 `minially`로 바꿔 둠. `release` 브랜치는 아직 예전 구조라, **PR #29 병합 전에 운영 배포를 돌리면 빌드가 실패합니다.**
- minihub.pages.dev, minilog.pages.dev: 프로젝트 없음(배포 안 됨)

## 8. 시험 실행 결과 (이 세션에서 실제로 돌림)
| 명령 | 결과 |
|---|---|
| `minially`: `npm run lint` | 오류 없음 |
| `minially`: `npm run build`, `npm run build:pages` | 성공 |
| `minially`: `node --import tsx --test tests/*.unit.mjs` | 32 passed |
| `minially`: `npm run desktop:prepare && npm run test:desktop:unit` | 20 passed |
| `minially`: `npm run test:sync` | 13 passed (1.5m) |
| `minially`: `npm test` | 223 passed (4.7m) |
| `hub`: `npm run lint`, `npm run build` | 성공 |
| `hub`: `npm test` | 6 passed |
| `minilog`: `npm run lint`, `npm run build` | 성공 |
| `minilog`: `npm test` | 6 passed |
| Windows 설치 파일·패키지 실행 시험 | **안 돌림**(Windows 실행기 필요) |
| `hub-minilog-check.yml` 워크플로 | **GitHub에서 아직 안 돌려 봄** |

로컬 시험 브라우저는 `PLAYWRIGHT_CHANNEL` 기본값 `chrome`, CI는 `chromium`. `@playwright/test`는 미니어리와 같은 1.64.1로 고정했습니다(실행 환경의 브라우저 버전과 맞추려고).

## 9. 알려진 오류·보안 위험
- `.env.example`(minially)은 AI Studio 시절 것이라 지금 구조와 맞지 않습니다. `@google/genai`도 미니어리에서 안 쓰는데 의존성에 남아 있습니다. 브라우저 번들에 들어가는지 확인 후 정리 권장.
- 세션 쿠키는 SameSite=Lax이고, 상태를 바꾸는 요청(POST·PUT·DELETE)은 `Origin`이 같은 사이트일 때만 받습니다(`sameOrigin`). Origin이 없는 요청은 통과시키므로(서버 간 호출) 세션 쿠키 검사가 마지막 방어선입니다.
- 로그인 시도 제한은 IP 기준이라 IP를 바꾸며 시도하면 막지 못합니다(코드가 80비트라 실질 위험은 낮음).
- `STATS_API_TOKEN` 비교는 해시끼리 문자열 비교입니다(타이밍 차이는 거의 없지만 상수 시간 비교는 아님).
- 자동 저장은 마지막에 저장한 것이 이깁니다. 같은 원고를 두 기기에서 동시에 고치면 한쪽 수정이 사라질 수 있습니다(버전 검사 없음).
- 원고 목록은 최근 200개까지만 불러옵니다.
- AI 초안은 지금 본문을 덮어씁니다(확인 창이 있음, 되돌리기는 없음).

## 10. 다음 개발 우선순위(권장)
1. 소유자 설정 후 실제 배포 확인 + 실제 Gemini 1회 호출 확인(모델 이름)
2. 미니로그 사진: R2 `MINILOG_PHOTOS` 업로드(크기·형식 검사, 사용자별 키 접두어 `C/…`), 30일 수명 규칙, Gemini 사진 분석(inline_data)
3. 게시 완료 URL 칸, 승인 → 발행 흐름
4. 미니로그 개인 대시보드, 참고 블로그(붙여 넣기 방식) 분석
5. 추정 비용(모델 단가 표)
6. 원고 동시 수정 버전 검사

## 11. Codex가 바꾸면 안 되는 것(호환 조건)
- `minially/desktop/policy.cjs`의 `API_ORIGIN = 'https://minially.pages.dev'`, `minially/electron-builder.yml`의 업데이트 주소 `github.com/minho-nim/minially/releases/latest/download/`: 이미 깔린 Windows 앱이 이 주소로 동기화·업데이트합니다.
- 미니어리 동기화 API(`minially/functions/api/sync.ts`·`share.ts`·`shared.ts`)의 요청·응답 형식과 `SYNC_CODE_HASHES` 방식, `normalizeCode` 규칙: 기존 앱·데이터가 이것으로 동작합니다.
- D1의 `sync_*` 표 구조와 `space` 값(코드 해시 앞 16글자): 기존 동기화 데이터가 이 키로 저장돼 있습니다.
- 브라우저 IndexedDB 이름 `DayFlowDB`와 예전 키 `DAYFLOW_APP_DATA_V1` 읽기: 기존 사용자 데이터 보존용.
- `release` 브랜치에 직접 커밋하지 않기(운영 배포는 `deploy-release.yml`의 fast-forward만).
- `USER_CODE_HASHES`의 `normalizeCode` 규칙은 미니어리와 **같아야** 합니다(같은 코드로 로그인).
- 키·코드·세션 토큰 원문을 응답·로그·D1·커밋에 남기지 않기. 통계 API는 숫자만.
