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
| `GEMINI_MODEL` | (선택) 기본 `gemini-3.5-flash-lite`(사용자 C·D 같음)가 안 될 때만 | 선택 | 선택 |

비밀값을 넣거나 바꾼 뒤에는 Deployments에서 **Retry deployment**를 한 번 해야 반영됩니다.

## 4-1. 미니어리 '사진으로 일정 넣기' (minially 프로젝트, 2026-11-26)
minially 프로젝트에도 아래 비밀값을 **minihub·mini-log와 같은 값**으로 넣어야 사진 읽기가 켜집니다(없으면 앱이 "아직 연결되지 않았어요"라고 안내).

| 이름 | 값 | 넣는 곳 |
|---|---|---|
| `USER_CODE_HASHES` | minihub와 같은 값(`C:<해시>,D:<해시>`) | minially 프로젝트 Secret |
| `GEMINI_KEY_C`, `GEMINI_KEY_D` | minihub와 같은 키 | minially 프로젝트 Secret |
| `GEMINI_PHOTO_MODEL` | (선택) 기본 `gemini-3.5-flash-lite`가 안 될 때만 | minially 프로젝트 변수 |

미니어리 코드가 미니허브 사용자 코드와 같아야 그 사람의 키로 읽습니다. 넣은 뒤 **Retry deployment**.

**로그인 코드 기준은 미니허브(2026-11-26, 미니어리 0.1.20부터):** 미니허브의 `USER_CODE_HASHES`에 있는 코드면 미니허브·미니로그·미니어리 세 앱 모두 로그인됩니다. 미니어리는 예전 `SYNC_CODE_HASHES`(해시만)도 그대로 받으니 지우지 않아도 됩니다. 해시 규칙이 같아 같은 코드면 미니어리 데이터 공간도 그대로입니다(코드·해시를 바꿀 필요 없음). 새 사람을 붙일 때는 미니허브 줄에만 넣고, 같은 줄을 mini-log·minially 프로젝트에 복사합니다. 사진은 서버에 저장되지 않고, 사용량은 미니허브 AI 사용량에 '미니어리'로 잡힙니다.

## 4-2. 미니로그 네이버 메일 자동 처리 (mini-log 프로젝트, 2026-11-26)
메일을 15분마다 받아 협찬 관련 메일을 고르고 답장 초안을 써 둡니다. 보내기는 사람이 '보내기 → 보내기 확정'을 누를 때만 됩니다.
1. 사람마다 네이버 메일 → 환경설정 → POP3/IMAP 설정 → IMAP 사용함.
2. 네이버 2단계 인증을 켜고 메일용 **애플리케이션 비밀번호**를 만든다(진짜 네이버 비밀번호는 쓰지 않는다. 문제가 생기면 그 앱 비밀번호만 지우면 끊긴다).
3. mini-log 프로젝트 비밀값(Secret):
   - `NAVER_MAIL_C` = `아이디@naver.com:애플리케이션비밀번호`
   - `NAVER_MAIL_D` = 같은 형식(D가 쓸 때만)
   - `GMAIL_MAIL_C` = `주소@gmail.com:앱비밀번호` (Gmail, 선택. 구글 계정 2단계 인증 → 보안 → 앱 비밀번호. 빈칸은 지워도 되고 서버가 지움)
   - `GMAIL_MAIL_D` = 같은 형식(D가 쓸 때만). 네이버·Gmail을 둘 다 넣으면 한 메일함에 모이고, 답장은 받은 계정으로 나간다
   - 권장: 블로그·협찬 전용 Gmail을 새로 만들어 쓰기(앱 비밀번호가 새도 협찬 메일만 영향), Gemini 키용 구글 계정과는 따로
   - `MAIL_CRON_TOKEN` = 아무도 모르는 긴 글자(예: `openssl rand -hex 32`로 만든 값)
4. GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret: `MAIL_CRON_TOKEN` = 3번과 **같은 값**. 그러면 `mail-sync.yml`이 15분마다 받는다. 토큰이 없으면 예약 작업은 아무것도 안 한다.
5. 다시 배포(비밀값은 배포 뒤 적용) → 미니로그 '메일' 화면에서 '지금 받기'로 한 번 확인.
- 서버 주소는 imap.naver.com(993, SSL)·smtp.naver.com(465, SSL). 키·비밀번호는 채팅·코드에 붙여 넣지 말 것.

## 5. USER_CODE_HASHES 만들기
minihub가 배포되면 `https://minihub.pages.dev/code-hash.html`을 엽니다.
사용자를 고르고 미니어리 로그인 코드를 넣으면 `C:abc…` 한 줄이 나옵니다(코드는 브라우저 안에서만 계산하고 어디에도 보내지 않음).
C와 D를 쉼표로 이어 붙여 `USER_CODE_HASHES`에 넣습니다. 예: `C:abc…,D:def…`

## 6. 확인
- minihub.pages.dev: 로그인 → 대시보드에 "사용자 C" · Gemini 연결됨
- mini-log.pages.dev: 로그인 → 새 원고 → 경험 적고 "AI로 초안 만들기"
