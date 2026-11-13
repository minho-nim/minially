import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';
import { defineConfig, type Plugin } from 'vite';

// 배포 확인용 버전: Cloudflare 빌드는 CF_PAGES_COMMIT_SHA, 그 밖에는 git 커밋
function commitSha() {
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA.slice(0, 7);
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short=7 HEAD').toString().trim(); } catch { return 'dev'; }
}
const APP_VERSION = commitSha();
const versionFile = (): Plugin => ({
  name: 'minially-version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ commit: APP_VERSION, builtAt: new Date().toISOString() }) });
  },
});
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const base = mode === 'github-pages' ? '/minially/' : '/';
  return {
    base,
    define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
    plugins: [
      versionFile(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png', 'icon.svg', 'minially-share-20261110.png'],
        manifest: {
          id: base,
          name: '미니어리 (Minially) · 간편 일정관리',
          short_name: '미니어리',
          description: '누구나 빠르고 쉽게 등록하고 관리하는 심플 캘린더 & 할 일 플래너',
          theme_color: '#FFF8FA',
          background_color: '#FFF8FA',
          display: 'standalone',
          // PC 설치 앱: 창 제목 표시줄 자리까지 앱 화면으로 쓴다(지원하지 않으면 standalone).
          display_override: ['window-controls-overlay', 'standalone'],
          // 작업 표시줄·시작 메뉴 아이콘 오른쪽 클릭 메뉴
          shortcuts: [
            { name: '새 일정', short_name: '새 일정', url: `${base}?action=new`, icons: [{ src: `${base}pwa-192x192.png`, sizes: '192x192', type: 'image/png' }] },
            { name: '오늘 일정', short_name: '오늘', url: `${base}?action=today`, icons: [{ src: `${base}pwa-192x192.png`, sizes: '192x192', type: 'image/png' }] },
            { name: '할 일', short_name: '할 일', url: `${base}?tab=tasks`, icons: [{ src: `${base}pwa-192x192.png`, sizes: '192x192', type: 'image/png' }] },
            { name: '검색', short_name: '검색', url: `${base}?action=search`, icons: [{ src: `${base}pwa-192x192.png`, sizes: '192x192', type: 'image/png' }] },
          ],
          start_url: base,
          scope: base,
          icons: [
            {
              src: `${base}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}pwa-maskable-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/portfolio/index.html'],
          // 포트폴리오 페이지(/portfolio)는 앱 화면으로 가로채지 않는다. 체험 주소 /portfolio/demo 는 앱이 연다.
          navigateFallbackDenylist: [/\/api\//, /^\/portfolio\/?(index\.html)?$/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
