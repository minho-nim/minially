# 미니허브 (MINIHUB)

미니어리와 미니로그를 묶는 상위 저장소입니다. 앱마다 폴더가 따로 있고, 빌드와 배포도 앱별로 따로 합니다.

```
minihub/
├── minially/   미니어리: 일정·할 일·메모 (웹 + Windows 앱)
├── minilog/    미니로그: 사진 중심 AI 블로그 원고 (준비 중)
└── hub/        미니허브 첫 화면: 공통 로그인·Gemini 연결 상태·사용량 (준비 중)
```

## 미니어리 실행

```sh
cd minially
npm ci
npm run dev
```

자세한 사용법과 시험 방법은 [minially/README.md](minially/README.md)를 보세요.

## 배포

- 미니어리 운영 주소: https://minially.pages.dev (Cloudflare Pages, Root directory는 `minially`)
- Windows 앱 자동 업데이트는 이 저장소의 GitHub Releases를 씁니다. 저장소 이름을 바꾸면 업데이트 주소(`minially/electron-builder.yml`)도 같이 바꿔야 합니다.
