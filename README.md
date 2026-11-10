# 미니어리 (Minially)

로즈 핑크 스타일의 일정·할 일 플래너입니다. 기존 DayFlow 프로젝트를 이어서 사용합니다.

## 실행

Node.js 22.12 이상과 npm을 사용합니다.

```sh
npm ci
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 현재 일정·문구 기능에는 API 키가 필요하지 않습니다.

## 자주 쓰는 문구

- 일정 제목 아래에 즐겨찾기를 우선으로 최대 3개의 문구를 표시하고 부족한 자리는 최근 사용 문구로 채웁니다. **더보기**에서 전체 목록을 검색하고 **편집**에서 순서를 관리합니다.
- **교체** 또는 **이어 붙이기**로 문구를 적용하고 **이전 제목 복구**로 적용 전 내용을 되돌릴 수 있습니다.
- **자주 쓰는 문구로 저장**으로 현재 작성 중인 제목을 저장합니다. 동일한 제목이 있으면 중복 생성하지 않습니다.
- 설정의 **자주 쓰는 문구**에서도 같은 목록을 관리합니다.
- 문구를 선택하면 제목에 입력됩니다. 날짜·시간·카테고리·메모는 유지하며 제목을 다시 편집할 수 있습니다.
- 문구를 바꾸거나 삭제해도 이미 저장한 일정은 그대로 유지됩니다.
- 즐겨찾기는 목록 위에 표시됩니다. **지정 순서**에서 화살표로 같은 즐겨찾기 그룹 안의 순서를 바꿉니다. **최근 사용순**, **자주 사용순**도 선택할 수 있습니다.
- 저장 실패 시 오류를 표시하고 작성 중인 내용을 유지합니다.

## 저장과 백업

데이터는 현재 브라우저의 IndexedDB에 저장됩니다. 이름을 바꾸기 전의 `DayFlowDB`와 `DAYFLOW_APP_DATA_V1`을 그대로 읽어 기존 데이터를 보존합니다. 새 문구의 순서는 sortOrder로 저장하며 이전 order 값과 고유 ID를 보존해 변환합니다. 기존 일정이나 문구를 자동 삭제하지 않고, 빈 목록에 예시를 채우지 않습니다.

설정의 **백업/복원**에서 일정·문구·즐겨찾기·사용 횟수·지정 순서를 JSON 파일로 내보내고 복원할 수 있습니다. 복원은 파일에 포함된 목록을 대체합니다. 저장 중 오류가 나면 해당 복원 전체를 취소합니다. 브라우저나 배포 주소가 바뀌면 기존 주소에서 백업한 파일을 새 주소에서 복원하세요.

## 검사

```sh
npm run lint
npm run build
npm test
```

브라우저 테스트는 설치된 Google Chrome을 기본으로 사용합니다. 별도 Chromium을 쓰려면 `npx playwright install chromium` 실행 후 `PLAYWRIGHT_CHANNEL=chromium` 환경 변수로 실행합니다. 테스트마다 독립된 브라우저 저장 공간을 사용합니다.

테스트에는 문구 추가·수정·삭제와 취소, 새로고침, 일정 제목 적용과 편집·저장, 기존 일정 보존, JSON 백업·복원, 즐겨찾기·순서, 저장 오류와 재시도, 이전 데이터 이관, 잘못된 복원 롤백이 포함됩니다.

## PC·폰 연결 (서버 동기화)

설정 → **백업/복원** → **PC·폰 연결**에 연결 코드를 입력하면 같은 코드를 쓰는 기기끼리 일정·할 일·문구·카테고리·설정이 자동으로 맞춰집니다. 코드가 없으면 지금처럼 이 브라우저에만 저장합니다.

- 코드 하나가 데이터 공간 하나입니다. 다른 코드의 데이터는 보이지 않습니다.
- 기기에 먼저 저장하고, 인터넷이 연결되면 서버와 맞춥니다(오프라인에서도 사용 가능). 같은 항목을 두 기기에서 고치면 나중에 맞춘 쪽이 남습니다.
- 처음 연결할 때 서버와 이 기기에 모두 데이터가 있으면 **합치기** 또는 **서버 데이터로 바꾸기**를 고릅니다.
- 실행 취소 기록은 기기마다 따로 둡니다.

서버는 Cloudflare Pages Functions(`functions/api/sync.ts`)와 D1입니다. 서버는 코드 원문을 모르고 SHA-256 해시만 가집니다. 표는 첫 요청 때 자동으로 만듭니다.

처음 한 번 설정(Cloudflare 대시보드):
1. **Storage & Databases → D1 → Create database**, 이름 `minially`
2. Pages 프로젝트 **minially → Settings → Bindings → Add → D1 database**, 변수 이름 `DB`, 데이터베이스 `minially` (Production)
3. **Settings → Variables and Secrets → Add**, 종류 **Secret**, 이름 `SYNC_CODE_HASHES`, 값은 코드 해시들을 쉼표로 이은 것
4. 다시 배포(운영 배포 실행 또는 Deployments에서 Retry)

코드 해시 만들기: `printf '%s' 'ABCD1234EFGH5678' | sha256sum` (대문자, `-` 없이)

로컬 시험: `.dev.vars`에 `SYNC_CODE_HASHES=<해시>`를 넣고 `npm run build && npx wrangler pages dev dist --d1 DB=minially-local`.

## Cloudflare Pages 배포

**배포 규칙:** Cloudflare는 `release` 브랜치만 운영 배포합니다. `main`에 병합해도 Cloudflare 사이트는 바뀌지 않습니다(GitHub Pages는 main 기준 그대로).

처음 한 번 연결:
1. [Cloudflare 대시보드](https://dash.cloudflare.com) → Workers & Pages → Create → **Pages** → **Connect to Git** → `minho-nim/minially` 선택
2. 빌드 설정: Production branch **`release`**, Framework preset Vite(또는 None), Build command `npm run build`, Build output directory `dist`
3. Node 버전은 저장소의 `.node-version`(24)을 따릅니다. 필요하면 환경 변수 `NODE_VERSION` = `24`를 넣습니다.
4. Save and Deploy. 끝나면 `https://<이름>.pages.dev` 주소가 생깁니다.
5. 브랜치마다 미리보기 사이트가 생기지 않게: Settings → Builds → Branch control → Preview branches를 **None**으로.

배포 훅(권장): Cloudflare Pages → minially → Settings → Builds → **Deploy hooks** → 브랜치 `release`로 만들고, 주소를 GitHub 저장소 Settings → Secrets and variables → Actions에 `CLOUDFLARE_DEPLOY_HOOK`으로 저장합니다. Actions가 올린 push를 Cloudflare가 놓칠 때가 있어 운영 배포가 이 훅으로 빌드를 직접 요청합니다.

배포: GitHub Actions → **운영 배포(release)** → Run workflow. main 최신 커밋의 검사가 통과했을 때만 `release`를 `main`으로 앞당깁니다(fast-forward만). 직접 할 때는 `git fetch origin && git push origin origin/main:refs/heads/release`.

## GitHub Pages 배포

실사용 주소: https://minho-nim.github.io/minially/

`main` 브랜치에 업로드하면 GitHub Actions가 타입 검사와 빌드를 실행한 뒤 자동 배포합니다. `npm run build:pages`는 `/minially/` 경로에 맞춘 화면·아이콘·PWA 파일을 생성합니다.

배포 주소가 달라지면 브라우저 저장 공간도 분리됩니다. 이전 Sites 주소에 저장한 데이터는 설정에서 JSON 백업 후 새 주소에서 복원할 수 있습니다.
