import {DesktopUpdates} from './DesktopUpdates';
import {formatAppVersion} from '../../utils/appVersion';
import {useEffect,useState} from 'react';
import {Download,Monitor,Keyboard} from 'lucide-react';
import type {DesktopState,DesktopPreferences} from '../../desktop';
export const WINDOWS_DOWNLOAD='https://github.com/minho-nim/minihub/releases/download/minially-latest/Minially-Setup.exe';
export function DesktopAppPanel(){
 const api=window.miniallyDesktop,[state,setState]=useState<DesktopState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!api)return;let active=true;const off=api.onState(value=>{if(active)setState(value);});void api.getState().then(value=>{if(active)setState(value);}).catch(()=>{if(active)setError('앱 정보를 불러오지 못했습니다.');});return()=>{active=false;off();};},[]);
 if(!api)return <section aria-label="Windows 앱 다운로드" className="space-y-2 border-b border-app-line pb-4"><h4 className="text-sm font-bold text-app-ink flex gap-2 items-center"><Monitor className="w-4 h-4"/>Windows 앱</h4><p className="text-xs text-app-muted">별도 창에서 캘린더·할 일·메모를 사용하고, 같은 연결 코드로 기기 간 기록을 맞춰요.</p><a href={WINDOWS_DOWNLOAD} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 min-h-9 px-3 rounded-lg bg-app-accent-ink text-white text-xs font-semibold"><Download className="w-4 h-4"/>Windows 앱 다운로드</a><p className="text-[11px] text-app-muted">Windows 10·11 / 64비트 · 웹에서도 계속 사용할 수 있어요.</p><p className="text-[11px] text-app-muted">첫 설치 파일은 게시자 서명이 없어 Windows 확인 경고가 표시될 수 있어요.</p></section>;
 if(!state)return <p role="status" className="text-xs text-app-muted">{error||'앱 정보를 불러오는 중…'}</p>;
 async function run(action:()=>Promise<unknown>){if(busy)return;setBusy(true);setError('');try{await action();}catch{setError('열린 편집창과 저장 상태를 확인한 뒤 다시 시도해 주세요.');}finally{setBusy(false);}}
 const toggle=(key:keyof DesktopPreferences,checked:boolean)=>run(async()=>setState(await api!.updatePreferences({[key]:checked})));
 return <section aria-label="Windows 앱 설정" className="space-y-3">
  <div><h4 className="text-sm font-bold text-app-ink">미니어리 Windows 앱</h4><p className="text-xs text-app-muted">설치 버전 {formatAppVersion(state.version)}</p></div>
  <div className="p-3 rounded-xl border border-app-line bg-app-canvas space-y-2"><p className="text-xs font-semibold flex gap-2 items-center"><Keyboard className="w-4 h-4"/>빠른 메모 · Ctrl+Alt+M</p><p className="text-[11px] text-app-muted">{state.shortcutAvailable?'다른 프로그램을 쓰다가도 빠른 메모 창을 열 수 있어요.':'단축키를 등록하지 못했어요. 아래 버튼이나 트레이에서 열 수 있어요.'}</p><button type="button" onClick={()=>void run(()=>api!.showQuick())} disabled={busy} className="min-h-9 px-3 rounded-lg bg-app-soft text-app-accent-ink text-xs">빠른 메모 열기</button></div>
  <fieldset className="space-y-2"><legend className="text-xs font-semibold mb-1">앱 실행</legend>{([['alwaysOnTop','항상 위에 표시'],['closeToTray','창을 닫으면 트레이에 유지'],['startOnLogin','Windows 로그인 시 실행']] as const).map(([key,label])=><label key={key} className="flex items-center justify-between gap-3 min-h-9 text-xs"><span>{label}</span><input type="checkbox" aria-label={label} checked={state.preferences[key]} disabled={busy||(key==='startOnLogin'&&!state.canStartOnLogin)} onChange={event=>void toggle(key,event.target.checked)}/></label>)}</fieldset>
  <div className="border-t border-app-line pt-3"><DesktopUpdates state={state}/></div>
  {error&&<p role="alert" className="text-xs text-red-600">{error}</p>}
 </section>;
}
