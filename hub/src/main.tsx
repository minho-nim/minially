import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// 손글씨 글꼴은 앱에 직접 넣는다(외부 글꼴 서버에 요청하지 않음, SIL OFL)
import '@fontsource/caveat/latin-700.css';
import '@fontsource/gaegu/400.css';
import '@fontsource/gaegu/700.css';
import '../../shared/ui/base.css';
import './app.css';
import App from './App';
import { UpdateBanner } from './UpdateBanner';
import { applyTheme, cachedTheme } from '../../shared/client/theme';

applyTheme(cachedTheme()); // 지난번 테마로 바로 시작(깜빡임 없이), 로그인 정보를 받으면 다시 맞춘다

createRoot(document.getElementById('root')!).render(<StrictMode><App /><UpdateBanner /></StrictMode>);
