import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {MovedScreen} from './components/layout/MovedScreen';
import './index.css';

// GitHub Pages 빌드(예전 주소)는 서버가 없어 로그인할 수 없으므로 새 주소 안내만 보여 준다.
const moved = import.meta.env.MODE === 'github-pages';
createRoot(document.getElementById('root')!).render(moved ? <MovedScreen /> : <App />);
