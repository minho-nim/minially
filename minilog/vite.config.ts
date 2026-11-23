import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';

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
  plugins: [versionFile(), react()],
  // ../shared 폴더(공통 코드)를 개발 서버에서 읽을 수 있게 한다.
  server: { fs: { allow: ['..'] } },
});
