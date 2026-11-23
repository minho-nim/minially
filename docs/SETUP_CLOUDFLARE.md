# Cloudflare 설정 안내 (소유자가 직접)

미니허브 저장소는 앱마다 Cloudflare Pages 프로젝트를 따로 씁니다. 셋 다 같은 GitHub 저장소를 보고 **Root directory만 다릅니다.**
세 프로젝트는 **같은 D1 데이터베이스**를 `DB`라는 이름으로 연결합니다(미니어리 표와 이름이 겹치지 않게 만들어 둠).

## 1. 기존 minially 프로젝트 (완료)
| 칸 | 값 |
|---|---|
| Root directory | `minially` ✅ |
| Build watch paths → Include paths | `minially/*` (hub·mini-log만 고쳤을 때 다시 빌드하지 않게, 선택) |

## 2. 새 프로젝트 두 개 만들기
Workers & Pages → Create → Pages → Connect to Git → `minho-nim/minihub` 선택.

| 칸 | minihub 프로젝트 | mini-log 프로젝트 |
|---|---|---|
| Project name | `minihub` | `mini-log` |
| Production branch | `main` | `main` |
| Build command | `npm run build` | `npm run build` |
| Build output directory | `dist` | `dist` |
| Root directory | `hub` | `mini-log` (프로젝트 이름과 같은 폴더) |
| Build watch paths | `hub/*`, `shared/*` | `mini-log/*`, `shared/*` |

주소가 `minihub.pages.dev`·`mini-log.pages.dev`로 안 나오면(이미 다른 사람이 쓰는 이름) 실제 주소를 알려 주세요. `shared/client/api.ts`의 `APP_LINKS`를 고칩니다.

## 3. 데이터베이스 연결 (두 프로젝트 모두)
Settings → Bindings → Add → D1 database
- Variable name: `DB`
- D1 database: **minially 프로젝트가 쓰는 것과 같은 DB** (minially 프로젝트 Settings → Bindings에서 이름 확인)

처음 로그인할 때 새 표(hub_sessions·hub_attempts·ai_usage·minilog_drafts)가 자동으로 생깁니다. 미니어리 표(sync_*)는 건드리지 않습니다.

## 3-1. 사진 저장소 R2 (mini-log 프로젝트만)
1. Cloudflare 왼쪽 메뉴 **R2 Object Storage** → **Create bucket** → 이름 `minilog-photos` (지역은 자동). 처음 쓰면 R2 사용 신청(무료 10GB)을 먼저 해야 할 수 있습니다.
2. mini-log 프로젝트 Settings → Bindings → Add → **R2 bucket** → Variable name `MINILOG_PHOTOS`, bucket `minilog-photos`
3. 공개 주소(Public access)는 **켜지 않습니다.** 사진은 로그인한 본인만 앱을 거쳐 봅니다.

사진은 게시 완료 후 30일이 지나면 앱이 지웁니다(원고 목록을 열 때 정리). R2 수명 규칙은 따로 넣지 않아도 됩니다.

## 4. 비밀값 (Settings → Variables and Secrets → Add → **Secret**)
| 이름 | 값 | minihub | mini-log |
|---|---|---|---|
| `USER_CODE_HASHES` | `C:<해시>,D:<해시>` (아래 5번) | ✅ | ✅ |
| `GEMINI_KEY_C` | 사용자 C의 Gemini API 키 | ✅ | ✅ |
| `GEMINI_KEY_D` | 사용자 D의 Gemini API 키 | ✅ | ✅ |
| `STATS_API_TOKEN` | 아무도 못 맞힐 긴 무작위 글자(Minoffia 통계용) | ✅ | |
| `GEMINI_MODEL` | (선택) 기본 `gemini-2.5-flash`가 안 될 때만 | 선택 | 선택 |

비밀값을 넣거나 바꾼 뒤에는 Deployments에서 **Retry deployment**를 한 번 해야 반영됩니다.

## 5. USER_CODE_HASHES 만들기
minihub가 배포되면 `https://minihub.pages.dev/code-hash.html`을 엽니다.
사용자를 고르고 미니어리 로그인 코드를 넣으면 `C:abc…` 한 줄이 나옵니다(코드는 브라우저 안에서만 계산하고 어디에도 보내지 않음).
C와 D를 쉼표로 이어 붙여 `USER_CODE_HASHES`에 넣습니다. 예: `C:abc…,D:def…`

## 6. 확인
- minihub.pages.dev: 로그인 → 대시보드에 "사용자 C" · Gemini 연결됨
- mini-log.pages.dev: 로그인 → 새 원고 → 경험 적고 "AI로 초안 만들기"
