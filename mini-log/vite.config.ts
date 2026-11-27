import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// 배포 확인용 버전 파일(Cloudflare 빌드는 CF_PAGES_COMMIT_SHA)
function commitSha() {
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short=7 HEAD').toString().trim(); } catch { return 'dev'; }
}
const versionFile = (): Plugin => ({
  name: 'minilog-version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ app: 'minilog', commit: commitSha(), builtAt: new Date().toISOString() }) });
  },
});

export default defineConfig({
  // 켤 때 새 버전 알림이 version.json과 비교할 이 화면의 커밋
  define: { __APP_COMMIT__: JSON.stringify(commitSha()) },
  plugins: [
    versionFile(),
    react(),
    // 앱처럼 설치(PWA): 홈 화면·작업 표시줄에 토몽이 아이콘. 화면 파일만 저장해 두고 /api 응답은 저장하지 않는다(늘 서버에서 새로).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: '미니로그 (MINILOG) · 사진으로 쓰는 블로그 원고',
        short_name: '미니로그',
        description: '사진과 경험으로 네이버 블로그 원고를 만드는 AI 도우미',
        lang: 'ko',
        theme_color: '#FFF9F4',
        background_color: '#FFF9F4',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        // 휴대폰 '공유 → 미니로그'(설치한 앱에서만): 체험단 공고 주소·글은 '관심' 협찬으로, 갤러리 사진은 고른 원고에 바로 넣는다.
        // POST라 서비스 워커(share-target-sw.js)가 받는다. 사진은 이 기기 캐시에 잠깐 두고 앱이 꺼내 올린 뒤 지운다.
        share_target: { action: '/share', method: 'POST', enctype: 'multipart/form-data', params: { title: 'title', text: 'text', url: 'url', files: [{ name: 'photos', accept: ['image/*'] }] } },
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 한글 손글씨 글꼴은 조각이 많아 미리 받지 않고, 화면에 쓰인 조각만 받아 저장한다.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        runtimeCaching: [{
          urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'font',
          handler: 'CacheFirst',
          options: { cacheName: 'fonts', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 } },
        }],
        navigateFallbackDenylist: [/^\/api\//, /^\/code-hash\.html$/, /^\/version\.json$/],
        importScripts: ['/share-target-sw.js', '/push-sw.js'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // ../shared 폴더(공통 코드)를 개발 서버에서 읽을 수 있게 한다.
  server: { fs: { allow: ['..'] } },
});
