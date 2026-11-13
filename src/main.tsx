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
else if (moved) render();
else enterDemoFromPath(syncEngine.connected).then(reloading => { if (!reloading) render(); }, render);
