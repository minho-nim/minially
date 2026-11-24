# Codex 인계 문서 — MINIHUB 1차 개발 (Claude)

작성일: 2026-11-23 · 작업 브랜치: `claude/eager-gauss-nzn2jd` · PR: minho-nim/minihub #29~#31 (저장소 이름은 2026-11-23에 minially → minihub로 바뀜)
이 문서는 **실제로 구현·검증한 것**과 **계획만 세운 것**을 나눠 적었습니다. 검증 표시가 없는 항목은 검증하지 않은 것입니다.

## 1. 구조
```
(저장소 minho-nim/minihub, 예전 이름 minially)
├── minially/   기존 미니어리 전체(웹 + Windows 앱 + Pages Functions). 위치만 옮김, 코드 변경 없음
├── hub/        미니허브 대시보드(React + Vite + Pages Functions)
├── mini-log/   미니로그(React + Vite + Pages Functions)
├── shared/
│   ├── server/   로그인·세션(auth), Gemini 호출(ai), 사용량(usage), 표 만들기(schema), 공통 타입(d1)
│   ├── client/   브라우저 fetch 도구·앱 주소(api.ts)
│   ├── ui/       공통 색·글자 토큰(base.css)
│   └── testing/  가짜 Gemini 서버(mock-gemini.mjs)
├── docs/       SETUP_CLOUDFLARE.md(소유자 설정), 이 문서
└── .github/workflows/  deploy-pages·desktop-release·deploy-release(미니어리), hub-minilog-check(hub·mini-log 검사)
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
| 미니 가족 디자인: 캐릭터 토몽이(새싹 달린 토마토 SVG), 손글씨 서명 로고, 토마토 서명 색, 앱별 손글씨 글꼴(앱에 내장) | `shared/ui/tomong.ts`, `shared/ui/base.css`, `hub/DESIGN.md` | 화면 확인(PC·폰), 시험 통과 |
| 코드 해시 도우미(브라우저 안에서만 계산) | `hub/public/code-hash.html` | 시험(서버 요청 없음) |
| 미니허브 통합 대시보드(기본, C·D 합계·사용자별·앱별·모델·작업별·오류 종류·게시 글 수) ↔ 내 대시보드 토글(선택은 브라우저에 기억) | `hub/functions/api/overview.ts`, `hub/src/App.tsx` | 시험(합계·사용자별 숫자, 토글 유지, 비로그인 401) |
| 미니로그 내 대시보드(게시 글·AI 호출·토큰·오류·작업별·원고 상태·사진 용량·삭제 예정) | `mini-log/functions/api/dashboard.ts` | 시험(다른 사용자 숫자 섞이지 않음) |
| 미니로그 문체: 내 문체 1개 + 참고 블로그 문체 여러 개(최대 10). 글 붙여 넣기 → 분석 → 원고마다 문체 선택(내 문체/참고/없음). 참고 문체는 말투·리듬·구성만 쓰고 자주 쓰는 표현은 AI에 보내지 않으며 베끼지 말라고 안내 | `mini-log/functions/_style.ts`, `api/styles/*`, `minilog_drafts.style_id` | 가짜 Gemini로 시험(참고 문체 표현이 프롬프트에 안 들어감, 남의 문체 수정·삭제 404, 지우면 원고는 내 문체로) |
| 사진 순서 바꾸기, 순서 변경·삭제 시 본문 [사진 n] 번호 자동 맞춤 | `api/drafts/[id]/photos.ts` PUT, `mini-log/src/photoMarkers.ts` | 시험 |
| 미니로그 협찬·광고 수익 기록: 캠페인(업체·이름·제공 내용·금액·마감일·상태·받은 날·연결 원고·메모), 광고 수익, 내 대시보드 수익 칸(이번 달·6개월·받을 금액·다가오는 마감). 본인 화면 + 미니허브 통합 대시보드(소유자 요청, C·D 합계·사용자별·6개월·다가오는 마감)에서 봄. Minoffia 통계 API(/api/stats)에는 내보내지 않음 | `mini-log/functions/_campaigns.ts`, `api/campaigns/*`, `mini-log/src/Campaigns.tsx` | 시험(정산→수익 합계, 잘못된 날짜·금액·상태·남의 원고 거절, 다른 사용자 404) |
| 미니로그 콘텐츠 캘린더: 게시 예정 원고·게시 완료·협찬 마감을 한 달 달력에, 날짜를 골라 그날 게시할 원고 만들기, 원고에 게시 예정일 | `mini-log/src/Calendar.tsx`, `minilog_drafts.planned_on` | 시험(예정·마감 표시, 날짜로 원고 생성, 예정일 지우면 빠짐, 잘못된 날짜 400, 다른 사용자 안 보임) |
| 운영 DB 기존 표에 칸 더하기: `ensureColumn`(PRAGMA로 확인 뒤 없을 때만 ALTER TABLE ADD COLUMN) | `shared/server/schema.ts` | 시험(예전 구조 표 + 기존 원고 유지, 두 번 실행해도 안전) |
| 미니로그 내 블로그(사용자당 최대 5개, 네이버·티스토리): 네이버 아이디·주소 또는 티스토리 주소 → 공개 RSS(rss.blog.naver.com/아이디.xml, 이름.tistory.com/rss)로 최근 글 가져오기(블로그 키: 네이버는 아이디, 티스토리는 `tistory:이름`), 게시 주소(logNo)로 미니로그 원고 자동 짝짓기, 통계 캡처를 Gemini가 읽어 조회·공감·댓글 기록(캡처 저장 안 함), 직접 적기, 조회수·공감 정렬, 대시보드 조회수 TOP 3 | `mini-log/functions/_blog.ts`, `api/blog/*`, `mini-log/src/Blog.tsx`, 표 `minilog_blogs`·`minilog_posts`, 시험용 `BLOG_RSS_BASE` | 가짜 RSS·가짜 Gemini로 시험(없는 블로그, 짝짓기, 캡처 읽기·못 찾은 글, 쉼표 숫자, 다시 가져와도 숫자 유지, 다른 사용자 404). **실제 네이버 RSS 호출은 미검증**(작업 공간에서 접속 불가) |
| 미니로그 글감 추천: 다가오는 시기(앱 안 1년 달력 + 설·추석 날짜 표 2026~2029, 앞으로 45일) + 참고 블로그(사용자당 10개, 공개 RSS 최근 글 **제목만**) + 내 블로그(조회수 높은 글·자주 쓰는 태그·최근 글)·내 문체 요약·협찬 마감·게시 예정 → Gemini가 글감 8개(글감·제목·이유·해시태그·출처). "최신 검색 포함"을 켰을 때만 Gemini 구글 검색(`tools: google_search`, 이때는 JSON 모드를 못 써서 답 글에서 JSON을 꺼냄). 마지막 추천은 사용자별 저장. "이걸로 원고 만들기"(예정일 선택) → 제목·해시태그만 채운 원고(경험 칸은 비움). 구글 트렌드 RSS는 뉴스·연예 위주라 블로그 글감에 안 맞아 뺌(소유자 결정) | `mini-log/functions/_ideas.ts`(`upcomingSeasons`), `api/ideas/index.ts`·`watch.ts`, `mini-log/src/Ideas.tsx`, 표 `minilog_watch`·`minilog_ideas`, `callGemini`의 `search` | 가짜 Gemini로 시험(시기·참고 블로그 제목이 프롬프트에 들어감, 검색 모드에 tools 전송·글 섞인 JSON 읽기, 없는 블로그 오류, 다시 열어도 유지, 원고 생성, 비로그인 401, 시기 계산·해 넘김·설/추석). **실제 Gemini 검색 연결은 미검증**. 설·추석 표는 2029년까지라 그 뒤는 더해야 함 |
| 미니로그 올리기 보조(원고 ④ 올리기·게시): 한 번에 복사(제목·본문·해시태그, 본문의 [사진 n]은 '📷 사진 n'으로), 블로그처럼 보이는 미리보기에서 제목·문단·사진·해시태그를 눌러 바로 복사(사진은 PNG 이미지로 클립보드에 넣어 글쓰기에 바로 붙여 넣기, `PostPreview.tsx`), 사진을 글 순서대로 `minilog_날짜_01.jpg`로 받기(한글 파일 이름은 일부 브라우저에서 'download'로 바뀌어 영문), 네이버 글쓰기 열기, 올린 뒤 주소 넣어 게시 완료 | `mini-log/src/publishKit.ts`, `mini-log/src/PostPreview.tsx`, `mini-log/src/App.tsx` Editor | 시험(클립보드 글·이미지(PNG), 받은 파일 이름 2개, 게시 완료 뒤 숨김). 네이버 글쓰기 주소(`GoBlogWrite.naver`)와 네이버 에디터에 이미지 붙여 넣기는 실제로 확인하지 못함 |
| 월간 보고(미니로그 '월간보고' 탭 + 미니허브 '월간 보고' 칸): 그달 게시 글(블로그 RSS 기준, 미니로그 게시 수 따로)·조회·공감·댓글 합계, 조회수 TOP 5, 글 목록, 자주 쓴 태그, 받은 금액(협찬·광고·기타, 받은 날 기준), 협찬 건수, AI 사용량, 지난달 대비(+n ▲%), **규칙 기반 한 줄 평**(AI 없이 숫자로만 문장, 다음 달 글감 안내). 미니허브는 C·D 합계 + 사람별 비교표 + 각자 요약·TOP 3. 'PDF로 저장' = 브라우저 인쇄(A4 서식, 메뉴·버튼 빠짐, 수익·AI 사용량은 체크할 때만) | `shared/server/report.ts`(`monthlyReport`, `reportComments`), `shared/client/report.ts`, `mini-log/functions/api/report.ts`, `hub/functions/api/report.ts`, `mini-log/src/Report.tsx`, `hub/src/Monthly.tsx`, 두 앱 `app.css`의 `@media print` | 시험(합계·지난달 비교·달 이동·한 줄 평 문장·인쇄 서식에서 숨김·PDF 생성·다른 사용자 숫자 안 섞임·잘못된 달 400·비로그인 401). 조회수는 누적 숫자를 적은 날 기준이라 '그달 조회수'가 아니라 '그달 올린 글의 조회수 합계' |
| hub 설정 '내 설정': 이름 바꾸기(1~20자, 두 앱·통합 화면·월간 보고에 표시, 기본 '사용자 C'), 화면 테마(기기 설정 따라·밝게·어둡게, 서버 저장 → 두 앱 적용, 기기에도 기억해 첫 화면 깜빡임 없음), 처음 볼 대시보드(이 기기). 로그인 화면 문구 '코드를 입력해 주세요', 코드 칸은 비밀번호 칸(브라우저 비밀번호 저장으로 이 기기에 코드 기억), 로그인 유지는 쓰는 동안 자동 연장(남은 기간이 15일보다 짧으면 `/api/me`가 30일로 늘림). mini-log의 hub 링크·안내는 'hub'로 표기 | `shared/server/profile.ts`, 표 `hub_profiles`, `hub/functions/api/settings.ts`, `shared/server/auth.ts` `renewCookie`, `shared/client/theme.ts`, `hub/src/names.ts`, `hub/src/App.tsx` `SettingsCard` | 시험(이름 바꾸기·통합/월간 보고 반영·잘못된 이름·테마 400, 테마 유지, mini-log에 이름·테마 반영, 비밀번호 칸 속성, 세션 연장) |
| 협찬 제안서·제안 메일(협찬 화면 → '제안서·메일 만들기', 주소 `#proposal`): ① 기본 양식(블로그 이름·주제·한 줄 소개·소개·독자층·좋은 점·협찬 방식·진행 사례·연락처, 사용자당 1개 저장) + **AI로 초안 쓰기**(실제 숫자·실제 협찬 업체만 쓰게 지시) ② A4 미리보기·PDF(평균 조회수·월평균 글·진행한 협찬·대표 글 3개 자동, **단가는 옵션 기본 끔**, 켜면 '협의 가능' 붙음) ③ 제안 메일: 업체 이름만 넣으면 규칙 기반 기본 본문, 직접 고치면 덮지 않음, **AI로 다듬기**, 복사, 메일 앱 열기(mailto, 본문 1,800자까지, PDF는 직접 첨부) | `mini-log/functions/_proposal.ts`, `api/proposal/index.ts`·`draft.ts`·`mail.ts`, 표 `minilog_proposals`, `mini-log/src/Proposal.tsx`, `src/proposalKit.ts` | 시험(기본 메일 문장·을/를·단가 문장·mailto, AI 초안에 실제 숫자·업체, 저장 유지, 인쇄 서식, 고친 본문 유지·다듬기·되돌리기, 다른 사용자 안 보임, 잘못된 이메일 400, 비로그인 401) |
| 제안서 추가: '이번 제안용으로 고치기'(기본 양식은 그대로, 미리보기·PDF·메일에만 반영), 제안 보내기 탭 '메일 / 인스타 DM'(DM 기본 글 300자 안팎, `ig.me/m/아이디`로 DM 열기, 복사, AI 다듬기 kind=dm). AI 글 프롬프트에 `shared/server/koreanStyle.ts`(humanize-korean 요약 규칙) 적용 | `mini-log/src/Proposal.tsx`, `src/proposalKit.ts`, `functions/_proposal.ts` | 시험(업체용 수정 후 기본 양식 유지, DM 기본 글·주소·다듬기·규칙 포함) |
| 원고 ④ 인스타 게시물 글: 규칙으로 만든 글(사진 표시 빼기·해시태그 30개·2,200자) → 'AI로 인스타 글 쓰기'(`POST /api/drafts/:id/instagram`) → 고치기 → 복사. 자동 게시는 Meta 앱 심사가 필요해 안 함 | `src/publishKit.ts` `instagramText`, `functions/api/drafts/[id]/instagram.ts` | 시험 |
| 미니어리 0.1.10: 설치형 앱에서 화면 안 스크롤 탭(캘린더·메모)의 머리줄이 제목 표시줄 높이만큼 두 번 내려가 내용(메모 위쪽·휴지통 버튼)을 가리던 문제 수정. 체험 데이터 '친구 생일'을 반복 일정 없는 날로 | `minially/src/index.css`, `minially/src/sync/demoMode.ts`, `minially/tests/desktop-header-align.spec.ts` | 시험(미니어리 224) |
| 미니어리 0.1.11 백업 복원: 기본 '합치기'(지금 데이터 유지, 없는 항목 더함, 같은 항목은 백업 updatedAt이 더 클 때만 바꿈, 설정은 유지·프리셋 그룹은 없는 것만 더함), 복원 직전 `Minially_Backup_날짜_before-restore.json` 자동 내려받기, '전부 바꾸기' 체크 시 예전처럼 교체. 백업에 메모 사진 포함 | `minially/src/db/indexedDB.ts` `mergeAllData`·`validateBackup`, `SettingsModal.tsx`, `App.tsx` | 시험(합치기 결과·자동 백업 파일 이름·잘못된 파일·전부 바꾸기) |
| 미니어리 0.1.11 메모 수정 기록: IndexedDB v3 `noteVersions`(이 기기만, 동기화 안 함). 직접 고칠 때(10분 안 연속 수정은 한 번)·다른 기기에서 받을 때·되돌리기 전에 바뀌기 전 내용 저장, 같은 내용 중복 안 함, 메모당 30개. 편집기 '수정 기록' 버튼 → 목록·미리보기·되돌리기. 영구 삭제 시 함께 삭제 | `indexedDB.ts` `recordNoteVersion`·`getNoteVersions`·`snapshotNoteBeforeRestore`, `syncEngine.ts` applyRemote, `notes/NoteHistoryDialog.tsx` | 시험(묶음·30개·영구 삭제·되돌리기·동기화로 받은 변경 기록) |
| 미니어리 0.1.11 메모 사진: 문서 블록 `{type:'image', photoId}`(본문 글에는 `[사진]`), 사진은 `notePhotos` 저장소(동기화됨, 긴 변 1280px JPEG·240KB 이하, data URL). 편집기 '사진 넣기'·붙여넣기·끌어다 놓기. 서버 sync가 notePhotos 검사. 영구 삭제 시 사진도 삭제. **0.1.10 이하 앱은 사진 블록을 모르는 형식으로 보고 동기화가 멈춤 → 모든 기기 0.1.11로** | `src/types.ts` NoteImage·NotePhoto, `utils/noteRichDocument.ts`, `utils/notePhotos.ts`, `utils/imageResize.ts`, `notes/noteRichDom.ts`, `notes/RichNoteBody.tsx`, `functions/api/sync.ts` | 시험(형식 검사, 넣기·다시 열기·백업 포함·삭제, 실제 서버 동기화). 붙여넣기 시험은 없음(클립보드 파일 흉내가 어려움). shortcut: 원고에서 지운 사진의 고아 기록은 메모 영구 삭제 때까지 남음 |
| mini-log 원고 동시 수정 보호: 편집 화면이 PUT에 `base_updated_at`(마지막으로 본 수정 시각)을 보냄. 서버 원고가 더 새것이고 제목·본문·경험·해시태그가 다르면 덮어쓰지 않고 '… · 다른 기기 수정 사본' 원고로 남기고 409(code conflict, 최신 원고·사본) → 화면은 최신 내용으로 바꾸고 사본을 목록에 더함 | `functions/api/drafts/[id]/index.ts`, `_drafts.ts` `saveConflictCopy`, `src/App.tsx` Editor, `shared/client/api.ts`(ApiError.data) | 시험(두 기기) |
| mini-log 광고 수익 가져오기(CSV, 애드센스 준비): 협찬 화면 '광고 수익 가져오기' → CSV(애드센스·애드포스트 날짜별/월별 보고서, 한글·영어 머리글·탭·설명 줄·합계 줄) 읽어 달마다 합계 → `POST /api/campaigns/import-ads` → 달마다 '광고' 수익 1개(받은 날 = 말일, memo `import:출처:YYYY-MM`로 같은 달 다시 올리면 금액만 바꿈). 월간 보고·대시보드 수익에 들어감. 구글 자동 연결은 준비 중(앱 승인 필요) | `src/adsImport.ts`, `src/Campaigns.tsx` `AdImport`, `functions/api/campaigns/import-ads.ts` | 시험(CSV 읽기·기록·다시 올리기·월간 보고 반영·400) |
| mini-log 데이터 백업(대시보드 아래 '데이터 백업'): `GET /api/backup` = 원고·협찬·문체·제안서 양식·내 블로그·글 숫자·참고 블로그 JSON(사진·채팅·로그인 제외), `POST /api/backup` = 합치기(없으면 더함, 같은 id는 백업 updated_at이 더 클 때만 바꿈, 다른 사용자 id와 겹치면 건너뜀, 형식이 틀린 항목은 건너뜀, 내 문체는 하나로 합침, 블로그 5·참고 10·참고 문체 10 제한 지킴). 불러오기 전에 지금 데이터를 `minilog-backup-날짜-before-restore.json`으로 자동 받기 | `mini-log/functions/_backup.ts`, `api/backup.ts`, `src/Backup.tsx` | 시험(받기·같은 것 다시 합치기·최신만 바꿈·다른 사용자 건너뜀·잘못된 파일 400·비로그인 401) |
| hub 왼쪽 메뉴 'AI 사용량' → 내 대시보드의 AI 사용량 칸으로 이동(처음 볼 대시보드 설정은 그대로) | `hub/src/App.tsx` | 시험 |
| Minoffia 통계 API `GET /api/stats` (Bearer `STATS_API_TOKEN`, 숫자만) | `hub/functions/api/stats.ts` | 시험(토큰 없음·틀림 401, 맞음 200, 키 원문 없음) |
| 미니로그: 원고 목록·새 원고·편집·자동 저장(0.8초, 창 닫기·다른 앱으로 갈 때는 바로 저장 keepalive, 저장 전 닫으면 확인)·승인·삭제·발행용 복사. 지금 탭·원고를 주소 해시(`#ideas`, `#draft/아이디`)에 남김(새로고침 유지, 뒤로 가기 = 이전 화면) | `mini-log/src/App.tsx`, `mini-log/functions/` | 시험 |
| 미니로그: 경험 글 → AI 초안(제목·본문·[사진] 위치·해시태그) | `functions/api/drafts/[id]/generate.ts` | 가짜 Gemini로 시험 |
| 사용자별 데이터 분리(모든 쿼리에 `WHERE user = ?`) | `mini-log/functions/_drafts.ts` | 시험(D가 C 원고 목록·조회·수정 불가, 비로그인 401) |
| 미니로그 사진 여러 장 올리기(브라우저에서 긴 변 1600px JPG로 줄임, 장당 5MB·원고당 20장, 매직 바이트 검사) | `mini-log/functions/_photos.ts`, `api/drafts/[id]/photos.ts`, `api/photos/[id].ts` | 시험(로컬 R2) |
| 사진 보기·지우기(본인만, R2 공개 주소 없음) | `api/photos/[id].ts` | 시험(D가 C 사진 보기·지우기·올리기 404, 비로그인 401, 사진 아닌 파일 415) |
| 사진 분석: 앞 8장을 Gemini에 함께 보내 [사진 n] 위치 표시 | `api/drafts/[id]/generate.ts` | 가짜 Gemini로 시험(보낸 사진 수 확인) |
| 게시 완료 URL(http/https만) 기록, 게시 후 30일 지나면 사진 삭제, 게시 취소 시 삭제 예정 취소 | `_drafts.ts` `updateDraft`, `_photos.ts` `cleanupExpired` | 화면 시험 + node:sqlite로 시간 흐름 시험(29일 유지·31일 삭제·다른 사용자 사진 유지) |

## 3. 미완료(계획만)
- Cloudflare 프로젝트 minihub(Root `hub`)·mini-log(Root `mini-log`) 생성됨(2026-11-23). 앱 폴더 이름은 프로젝트 이름에 맞춰 minilog → mini-log로 바꿈. 앱 안의 이름(세션 app 'minilog', D1 표 minilog_*, R2 minilog-photos)은 데이터 호환 때문에 그대로. minihub.pages.dev·mini-log.pages.dev 주소를 쓸 수 있는지도 확인하지 못했습니다.
- **실제 Gemini 호출 검증 안 됨.** 가짜 서버로만 시험했습니다. 기본 모델 `gemini-2.5-flash`가 지금도 있는지 확인이 필요합니다(`GEMINI_MODEL`로 바꿀 수 있음).
- 미니로그 1단계는 모두 1차 구현. 참고 블로그는 붙여 넣기만(네이버 자동 수집 안 함). 참고 문체 원문(남의 글)은 사용자 계정에만 저장되며, 저작권 안내 문구를 화면에 표시
- 통합 대시보드는 로그인한 C·D 누구나 두 사람의 **숫자**를 봅니다(원고·사진·문체 글은 안 보임). 사용자가 늘면 권한을 나눠야 합니다.
- 사진 30일 정리는 원고 목록을 열 때만 돕니다(정해진 시각 작업 없음). 오래 접속하지 않으면 늦게 지워집니다.
- HEIC(아이폰 기본 형식) 사진은 브라우저가 못 열면 올릴 수 없습니다(안내 문구만 있음).
- 미니로그 개인 대시보드(호출량·원고 현황·사진 용량·수익)
- 미니로그 2·3단계 전체
- **미니어리 Gemini 연결 안 함.** 미니어리는 아직 AI 기능이 없고, `callGemini`가 `app: 'minially'`를 받을 수 있게만 해 둠
- 추정 비용은 만들지 않기로 함(소유자 결정, 사용량·토큰·오류만 표시)
- 미니어리 로그인과 미니허브 세션은 따로입니다(같은 코드지만 미니어리는 기존 방식 그대로, 각 사이트에서 따로 로그인). `*.pages.dev`끼리는 쿠키를 나눌 수 없어서입니다. 하나로 묶으려면 개인 도메인이 필요합니다.

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
| `DB` | D1 바인딩(세 프로젝트 같은 DB) | minially, hub, mini-log |
| `SYNC_CODE_HASHES` | 비밀값(기존) | minially |
| `USER_CODE_HASHES` | 비밀값 | hub, mini-log |
| `GEMINI_KEY_C`, `GEMINI_KEY_D` | 비밀값 | hub(연결 상태 표시), mini-log |
| `STATS_API_TOKEN` | 비밀값 | hub |
| `GEMINI_MODEL` | 변수(선택) | hub, mini-log |
| `GEMINI_API_BASE` | **시험 전용**. 운영에는 넣지 않음 | 시험 |
| `BLOG_RSS_BASE` | **시험 전용**(가짜 RSS 주소). 운영에는 넣지 않음 | 시험 |
| `MINILOG_PHOTOS` | R2 바인딩(버킷 `minilog-photos`, 공개 주소 끔) | minilog |
| `MINIHUB_LAYOUT_READY` | GitHub 저장소 변수 | deploy-release.yml |

D1 표(설정): `hub_profiles`. D1 표: 기존 `sync_meta`·`sync_records`·`sync_shares`·`sync_attempts`(미니어리), 신규 `hub_sessions`·`hub_attempts`·`ai_usage`·`minilog_drafts`·`minilog_photos`·`minilog_styles`·`minilog_campaigns`·`minilog_blogs`·`minilog_posts`·`minilog_watch`·`minilog_ideas`(`shared/server/schema.ts`, `CREATE TABLE IF NOT EXISTS`만).

## 7. 실제 배포 상태 (2026-11-23)
- minially.pages.dev: Windows 앱 0.1.9와 함께 운영 배포 완료(`3de87db`). 전용 배포판 `minially-latest` 생성 확인.
- minihub.pages.dev·mini-log.pages.dev: 운영 배포 완료(`0e09807`), DB·로그인 코드 설정 적용 확인(틀린 코드 거절). 실제 로그인·Gemini 호출은 소유자 확인 필요.
- **주의:** 운영 DB에 표가 이미 생겼으므로, 기존 표에 칸을 더할 때는 `ALTER TABLE`이 필요합니다(새 표는 CREATE로 충분).
- minially.pages.dev: Cloudflare Root directory `minially`.
- minihub.pages.dev, mini-log.pages.dev: 프로젝트 없음(배포 안 됨)

## 8. 시험 실행 결과 (이 세션에서 실제로 돌림)
| 명령 | 결과 |
|---|---|
| `minially`: `npm run lint` | 오류 없음 |
| `minially`: `npm run build`, `npm run build:pages` | 성공 |
| `minially`: `node --import tsx --test tests/*.unit.mjs` | 32 passed |
| `minially`: `npm run desktop:prepare && npm run test:desktop:unit` | 20 passed |
| `minially`: `npm run test:sync` | 13 passed (1.5m) |
| `minially`: `npm test` | 230 passed (11.0m), `npm run test:sync` 14 passed |
| `hub`: `npm run lint`, `npm run build` | 성공 |
| `hub`: `npm test` | 15 passed (AI 사용량 메뉴, 설정·로그인 유지, 월간 보고, 통합 대시보드·PWA 포함) |
| `mini-log`: `npm run lint`, `npm run build` | 성공 |
| `mini-log`: `npm test` | 45 passed (데이터 백업, 동시 수정·광고 수익 가져오기, 인스타 DM·인스타 글, 제안서·메일, 이름·테마, 월간 보고, 주소·뒤로 가기, 바로 닫기 저장, 올리기 보조, 사진·순서·게시·30일 정리·내 문체·참고 문체·대시보드·협찬·캘린더·칸 추가·블로그·글감 포함) |
| Windows 설치 파일·패키지 실행 시험 | **안 돌림**(Windows 실행기 필요) |
| `hub-minilog-check.yml` 워크플로 | **GitHub에서 아직 안 돌려 봄** |

로컬 시험 브라우저는 `PLAYWRIGHT_CHANNEL` 기본값 `chrome`, CI는 `chromium`. `@playwright/test`는 미니어리와 같은 1.64.1로 고정했습니다(실행 환경의 브라우저 버전과 맞추려고).

## 9. 알려진 오류·보안 위험
- `.env.example`(minially)은 AI Studio 시절 것이라 지금 구조와 맞지 않습니다. `@google/genai`도 미니어리에서 안 쓰는데 의존성에 남아 있습니다. 브라우저 번들에 들어가는지 확인 후 정리 권장.
- 세션 쿠키는 SameSite=Lax이고, 상태를 바꾸는 요청(POST·PUT·DELETE)은 `Origin`이 같은 사이트일 때만 받습니다(`sameOrigin`). Origin이 없는 요청은 통과시키므로(서버 간 호출) 세션 쿠키 검사가 마지막 방어선입니다.
- 로그인 시도 제한은 IP 기준이라 IP를 바꾸며 시도하면 막지 못합니다(코드가 80비트라 실질 위험은 낮음).
- `STATS_API_TOKEN` 비교는 해시끼리 문자열 비교입니다(타이밍 차이는 거의 없지만 상수 시간 비교는 아님).
- 자동 저장은 마지막에 저장한 것이 이깁니다. 같은 원고를 두 기기에서 동시에 고치면 한쪽 수정이 사라질 수 있습니다(버전 검사 없음).
- 원고 목록은 최근 200개까지만 불러옵니다(캘린더도 이 목록을 씀).
- 글감 검색 모드(구글 검색 연결)는 Gemini 무료 등급 하루 한도가 따로 있고 사용량이 더 듭니다. 버튼을 켰을 때만 씁니다.
- 운영 DB에 `minilog_trends` 표가 남아 있을 수 있습니다(글감 첫 배포 때 생김, 지금은 안 씀). 지워도 됩니다.
- 네이버는 블로그 글쓰기 API를 종료했고(개발자센터 공지), 조회수·공감·애드포스트 수익 API도 없음. 자동 게시·자동 통계는 하지 않음(약관). 검색·데이터랩 API는 NAVER API HUB(네이버 클라우드)로 이관 중이라 무료 여부 확인 전에는 쓰지 않음.
- 표 만들기 확인(`ensureHubSchema`)은 DB 바인딩 객체마다 한 번(WeakSet). 요청마다 바인딩 객체가 새로 오면 매 요청 CREATE IF NOT EXISTS·PRAGMA를 돌게 되니, D1 읽기 사용량이 늘면 확인할 것.
- `minilog_drafts`·`minilog_photos` 표는 아직 운영 DB에 없어서 CREATE 문에 칸을 바로 넣었습니다. 운영에 한 번 생긴 뒤 칸을 늘리려면 `ALTER TABLE`이 필요합니다(`schema.ts` 주석).
- AI 초안은 지금 본문을 덮어씁니다(확인 창이 있음, 되돌리기는 없음).

## 10. 다음 개발 우선순위(권장)
1. 소유자 설정 후 실제 배포 확인 + 실제 Gemini 1회 호출 확인(모델 이름)
2. 실제 Gemini로 사진 분석 품질 확인(사진 8장 기준 토큰·속도)
3. 미니로그 남은 것(소유자가 정한 순서): AI 채팅(mini-log, 토몽이에게 묻기, 질문 버튼) → 애드센스 연결(준비만). 그 밖에 원고 수정 이력 기반 문체 개선 
4. 원고 동시 수정 버전 검사

## 11. Codex가 바꾸면 안 되는 것(호환 조건)
- `minially/desktop/policy.cjs`의 `API_ORIGIN = 'https://minially.pages.dev'`, `minially/electron-builder.yml`·`minially/desktop/policy.cjs`의 업데이트 주소 `github.com/minho-nim/minihub/releases/download/minially-latest/`(미니어리 전용 고정 배포판, desktop-release.yml이 배포 때마다 갱신. 0.1.9부터. 0.1.8 이하 설치본은 예전 주소를 보며 GitHub 이름 변경 연결에 기대므로 끊기면 새로 설치): 이미 깔린 Windows 앱이 이 주소로 동기화·업데이트합니다.
- 미니어리 동기화 API(`minially/functions/api/sync.ts`·`share.ts`·`shared.ts`)의 요청·응답 형식과 `SYNC_CODE_HASHES` 방식, `normalizeCode` 규칙: 기존 앱·데이터가 이것으로 동작합니다.
- D1의 `sync_*` 표 구조와 `space` 값(코드 해시 앞 16글자): 기존 동기화 데이터가 이 키로 저장돼 있습니다.
- 브라우저 IndexedDB 이름 `DayFlowDB`와 예전 키 `DAYFLOW_APP_DATA_V1` 읽기: 기존 사용자 데이터 보존용.
- `release` 브랜치에 직접 커밋하지 않기(운영 배포는 `deploy-release.yml`의 fast-forward만).
- `USER_CODE_HASHES`의 `normalizeCode` 규칙은 미니어리와 **같아야** 합니다(같은 코드로 로그인).
- 키·코드·세션 토큰 원문을 응답·로그·D1·커밋에 남기지 않기. 통계 API는 숫자만.
