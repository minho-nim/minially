# 미니허브 (MINIHUB)

미니어리와 미니로그를 묶는 상위 저장소입니다. 앱마다 폴더가 따로 있고, 빌드와 배포도 앱별로 따로 합니다.

```
minihub/
├── minially/   미니어리: 일정·할 일·메모 (웹 + Windows 앱)
├── hub/        미니허브 대시보드: 공통 로그인·Gemini 연결 상태·AI 사용량
├── minilog/    미니로그: 사진 중심 AI 블로그 원고
├── shared/     공통 코드(로그인·세션·Gemini 호출·사용량·색 기준)
└── docs/       Cloudflare 설정 안내, Codex 인계 문서
```

## 미니허브·미니로그 실행

```sh
cd hub        # 또는 minilog
npm ci
npm run lint && npm run build
npm test      # 로컬 Cloudflare 서버 + 가짜 Gemini로 시험(실제 API 호출 없음)
```

Cloudflare 설정은 [docs/SETUP_CLOUDFLARE.md](docs/SETUP_CLOUDFLARE.md), 개발 현황은 [docs/HANDOFF_TO_CODEX.md](docs/HANDOFF_TO_CODEX.md)를 보세요.

## 미니어리 실행

```sh
cd minially
npm ci
npm run dev
```

자세한 사용법과 시험 방법은 [minially/README.md](minially/README.md)를 보세요.

## 배포

- 미니어리: https://minially.pages.dev (Cloudflare Pages, Root directory `minially`)
- 미니허브: https://minihub.pages.dev (Root directory `hub`, 준비 중)
- 미니로그: https://mini-log.pages.dev (Root directory `minilog`, 준비 중)
- Windows 앱 자동 업데이트는 이 저장소의 GitHub Releases(`minho-nim/minihub`)를 씁니다. 저장소 이름을 바꾸면 업데이트 주소(`minially/electron-builder.yml`, `minially/desktop/policy.cjs`)와 GitHub Pages 경로(`minially/vite.config.ts`)도 같이 바꿔야 합니다.
