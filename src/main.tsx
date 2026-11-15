import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {MovedScreen} from './components/layout/MovedScreen';
import './index.css';
import {syncEngine} from './sync/syncEngine';
import {enterDemoFromPath} from './sync/demoMode';

// GitHub Pages 빌드(예전 주소)는 서버가 없어 로그인할 수 없으므로 새 주소 안내만 보여 준다.
const moved = import.meta.env.MODE === 'github-pages';
const render = () => createRoot(document.getElementById('root')!).render(moved ? <MovedScreen /> : <App />);
// 서버가 /portfolio 를 앱 화면으로 넘긴 경우 포트폴리오 페이지(/portfolio/)로 보낸다.
if (!moved && window.location.pathname === '/portfolio') window.location.replace('/portfolio/');
// 지원서에 링크 3개가 쉼표로 붙어 한 주소(/portfolio,%20https://...)로 올라간 경우: 메인인 MinLab 아카이브로 보낸다.
// (서버의 public/_redirects 가 먼저 보내고, 서비스 워커가 앱 화면을 낸 경우 여기서 한 번 더 보낸다.)
else if (!moved && /^\/portfolio(,|%2C)/i.test(window.location.pathname)) window.location.replace('https://minho-nim.github.io/MinLab/');
else if (moved) render();
else enterDemoFromPath(syncEngine.connected).then(reloading => { if (!reloading) render(); }, render);
