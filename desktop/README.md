# 미니어리 Windows 앱

PC 웹을 그대로 유지하면서 Electron의 로컬 렌더러로 같은 캘린더·할 일·메모를 제공한다. 설정 → 앱 설치에서 Windows 설치 파일을 받는다. 웹과 앱의 저장소는 분리되어 있으므로 **같은 연결 코드**로 로그인해야 기록을 맞춘다. 연결 코드는 설정의 동기화에서 확인한다.

## 사용

Windows 10·11 x64에서 사용자별로 설치한다. 관리자 권한을 요청하지 않는다. 트레이를 사용하며 Ctrl+Alt+M으로 빠른 메모를 연다. 단축키가 다른 프로그램과 겹치면 설정이나 트레이에서 열 수 있다. 로그인 시 실행과 항상 위는 기본 꺼짐이다. 빠른 메모는 자동 저장하고 전체 메모장으로 이어서 편집한다. 기존 메모의 할 일·일정 연결 기능도 동일하다.

로컬 데이터는 Electron userData 아래 IndexedDB에 저장한다. 연결 코드는 같은 앱 프로필에 저장되므로 Windows 사용자 계정을 보호해야 한다. 제거 시 기록을 자동으로 지우지 않는다. 오프라인 편집 후 다시 접속하면 동기화하며, 서로 다른 기기 또는 전체 창과 빠른 창의 동시 수정은 사본을 보존한다. 충돌 사본은 직접 비교해 정리한다. 동기화는 별도 백업을 대신하지 않는다.

## 개발·검증

루트에서 Node 24 / npm 11.19.1을 사용한다. `.npmrc`로 의존성 설치 스크립트를 기본 차단한다.

```sh
npm ci --ignore-scripts
node node_modules/electron/install.js
npm run lint
npm run desktop:prepare
npm run test:desktop:unit
node tests-desktop/smoke.cjs
npm run desktop:start
```

`electron/install.js`는 검토한 공식 Electron 바이너리 설치 스크립트이며 공식 체크섬을 사용한다. Linux smoke의 no-sandbox는 격리된 CI 시험 인자이며 실제 배포 앱에서는 사용하지 않는다. 렌더러는 sandbox/contextIsolation을 켜고 Node를 노출하지 않는다. preload는 정해진 명령만 제공한다. 커스텀 프로토콜은 포함된 로컬 자원과 기존 서버의 sync/share/shared API만 허용하고 외부 실행 스크립트·임의 파일·임의 프록시를 차단한다. 연결 코드와 메모를 로그에 출력하지 않는다.

## 배포·업데이트

1. 소스 검사와 main의 전체 화면·실제 서버 동기화 CI를 통과시킨다.
2. Actions → **Windows 앱 빌드 및 배포**를 main에서 실행한다.
3. Windows 실행기에서 네이티브 창·빠른 메모·충돌 보존을 확인하고 NSIS 설치 파일을 만든다.
4. 파일·버전·SHA512를 검증한 뒤 `desktop-v0.1.0` 형식의 GitHub Release에 exe, blockmap, latest.yml을 공개한다.
5. 설정 다운로드 주소와 업데이트 피드는 최신 릴리스를 사용한다. 이후 릴리스는 `desktop/package.json` 및 루트 lock의 버전을 함께 올린다. 기존 릴리스는 덮어쓰지 않는다.

자동으로 확인·다운로드하되 즉시 설치하지 않는다. 사용자가 저장 후 재시작을 누르면 모든 창에 로컬 저장 완료를 확인하고, 실패하거나 편집창이 열려 있으면 재시작하지 않는다. 실제 새 버전으로의 교체는 후속 버전에서 추가 실기기 검증한다.

최초 설치 파일은 Authenticode 인증서가 없으며 게시자 경고가 발생할 수 있다. 회사 정책에 따라 실행을 차단할 수 있다. 서명은 `WINDOWS_CSC_LINK`, `WINDOWS_CSC_KEY_PASSWORD` 저장소 비밀값으로 설정할 수 있다. 인증서는 소스에 넣지 않는다. 업데이트 라이브러리의 기본 서명 검증을 끄지 않으며, 서명된 배포에서는 인증서 게시자를 함께 검증한다. 서명 없는 현재 배포는 HTTPS와 SHA512를 검증한다.

## 의존성 검토

2026-11-22 기준 `npm audit --audit-level=high`: high/critical 0. moderate는 개발·패키징 도구의 electron-builder/universal/dmg/squirrel, PWA/workbox/glob/minimatch 경로에 남는다. 해당 명령에 신뢰하지 않는 glob/압축 파일을 넣지 않으며 런타임 서버 API와 분리되어 있다. 강제 major 변경을 하지 않는다. `shortcut: 빌드 도구의 moderate 경고는 호환되는 수정 버전이 나오면 갱신하며 2026-12-22까지 재검토한다.` 최종 결과는 매번 CI audit가 다시 검사한다.
