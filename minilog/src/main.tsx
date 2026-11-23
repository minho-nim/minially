import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// 손글씨 글꼴은 앱에 직접 넣는다(외부 글꼴 서버에 요청하지 않음, SIL OFL)
import '@fontsource/caveat/latin-700.css';
import '@fontsource/nanum-pen-script/400.css';
import '../../shared/ui/base.css';
import './app.css';
import App from './App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
