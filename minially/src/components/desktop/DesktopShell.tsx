import {useEffect,useRef,useState,type ReactNode,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {Minus,Maximize2,Minimize2,X,Download,RefreshCw} from 'lucide-react';
import type {DesktopState} from '../../desktop';
import {formatAppVersion} from '../../utils/appVersion';
import {DesktopUpdates} from '../common/DesktopUpdates';
import {useScheduleDialog} from '../../hooks/useScheduleDialog';

function UpdatesDialog({open,state,error,onClose,onRetry}:{open:boolean;state:DesktopState|null;error:string;onClose:()=>void;onRetry:()=>void}){
 const ref=useRef<HTMLDivElement>(null),close=useRef<HTMLButtonElement>(null);
 useScheduleDialog(open,false,ref,onClose,onClose);
 useEffect(()=>{if(open)close.current?.focus();},[open]);
 if(!open)return null;
 return createPortal(<div style={{marginTop:40/(state?.preferences.zoomFactor??1)}} ref={ref} role="dialog" aria-modal="true" aria-label="앱 버전 및 업데이트" className="app-modal desktop-update-overlay fixed inset-0 z-[60] flex items-start justify-end p-3 bg-[rgba(52,40,35,0.18)]" onClick={event=>{if(event.target===event.currentTarget)onClose();}}><div className="w-full max-w-xs rounded-2xl border border-app-line bg-white p-4 shadow-lg text-app-ink"><div className="flex items-center justify-between gap-2 mb-3"><h2 className="font-bold text-sm">미니어리 {formatAppVersion(state?.version??__APP_RELEASE__)}</h2><button ref={close} aria-label="업데이트 창 닫기" onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-app-muted hover:bg-app-soft"><X size={16}/></button></div>{state?<DesktopUpdates state={state}/>:<div className="text-xs text-app-muted"><p>{error||'앱 정보를 확인하는 중…'}</p>{error&&<button onClick={onRetry} className="mt-2 min-h-9 px-3 border border-app-line rounded-lg">다시 확인</button>}</div>}</div></div>,document.body);
}
export function DesktopShell({children}:{children:ReactNode}){
 const api=window.miniallyDesktop,[state,setState]=useState<DesktopState|null>(null),[open,setOpen]=useState(false),[error,setError]=useState(''),[windowError,setWindowError]=useState('');
 const mounted=useRef(true),progress=state?.update.kind==='preparing'||state?.update.kind==='installing';
 useEffect(()=>{if(!progress)return;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';const block=(event:KeyboardEvent)=>{event.preventDefault();event.stopImmediatePropagation();};document.addEventListener('keydown',block,true);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',block,true);};},[progress]);
 useEffect(()=>{if(!api?.zoom||progress)return;let wheelAt=0;const change=(action:'in'|'out'|'reset')=>{void api.zoom(action).catch(()=>setWindowError('화면 배율을 바꾸지 못했습니다.'));};const wheel=(event:WheelEvent)=>{if(!event.ctrlKey||!event.deltaY)return;event.preventDefault();const now=performance.now();if(now-wheelAt<65)return;wheelAt=now;change(event.deltaY<0?'in':'out');};const key=(event:KeyboardEvent)=>{if(event.isComposing||event.altKey||(!event.ctrlKey&&!event.metaKey))return;const action=['+','='].includes(event.key)?'in':event.key==='-'?'out':event.key==='0'?'reset':null;if(action){event.preventDefault();event.stopPropagation();change(action);}};document.addEventListener('wheel',wheel,{passive:false});document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('wheel',wheel);document.removeEventListener('keydown',key,true);};},[api,progress]);
 async function read(){if(!api)return;setError('');try{const next=await api.getState();if(mounted.current)setState(next);}catch{if(mounted.current)setError('앱 정보를 확인하지 못했습니다.');}}
 useEffect(()=>{mounted.current=true;if(!api)return;const off=api.onState(setState);void read();const online=()=>{void api.checkUpdate().catch(()=>{});};window.addEventListener('online',online);return()=>{mounted.current=false;off();window.removeEventListener('online',online);};},[]);
 if(!api)return <>{children}</>;
 async function control(action:'minimize'|'maximize'|'close'){setWindowError('');try{await api!.windowAction(action);}catch{setWindowError('창을 조작하지 못했습니다. 다시 시도해 주세요.');}}
 const factor=state?.preferences.zoomFactor??1;
 const kind=state?.update.kind;
 const badge=kind==='preparing'?'저장 확인':kind==='installing'?'업데이트 중':kind==='ready'?'재시작 준비':kind==='downloading'?`${Math.round(state!.update.percent)}%`:kind==='available'?'새 버전':kind==='checking'?'확인 중':kind==='error'?'확인 필요':'';
 return <div style={{'--desktop-zoom':factor} as CSSProperties} className="desktop-shell" data-window-focused={state?.window?.focused!==false}>
  <header aria-label="앱 창 제목 표시줄" className="desktop-titlebar">
   <div role="group" aria-label="창 제어" className="desktop-window-controls">
    <button type="button" aria-label="창 닫기" title="창 닫기" onClick={()=>void control('close')} className="desktop-window-button desktop-window-close"><span><X size={9} strokeWidth={3}/></span></button>
    <button type="button" aria-label="창 최소화" title="최소화" onClick={()=>void control('minimize')} className="desktop-window-button desktop-window-minimize"><span><Minus size={9} strokeWidth={3}/></span></button>
    <button type="button" aria-label={state?.window?.maximized?'창 크기 복원':'창 최대화'} title={state?.window?.maximized?'이전 크기로 복원':'최대화'} onClick={()=>void control('maximize')} className="desktop-window-button desktop-window-maximize"><span>{state?.window?.maximized?<Minimize2 size={9} strokeWidth={2}/>:<Maximize2 size={9} strokeWidth={2}/>}</span></button>
   </div>
   <span className="desktop-window-title">{api.mode==='quick'?'빠른 메모':'미니어리'}</span>
   <div className="desktop-titlebar-tools flex items-center gap-1 justify-self-end min-w-0">
   {api.zoom&&<button type="button" aria-label="화면 배율 기본값으로 복원" title="Ctrl+휠: 50~150% · Ctrl+0: 기본값" onClick={()=>void api.zoom('reset').catch(()=>setWindowError('화면 배율을 바꾸지 못했습니다.'))} className="desktop-zoom-button text-[10px] text-app-muted min-h-7 px-1.5 rounded-md hover:bg-app-soft">{Math.round(factor*100)}%</button>}
   <button type="button" aria-label="앱 버전 및 업데이트 열기" aria-expanded={open} aria-haspopup="dialog" onClick={()=>{if(open)setOpen(false);else if(!document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]'))setOpen(true);}} className="desktop-version-button" data-update-state={kind} title={badge?`버전 정보 · ${badge}`:'버전 정보 · 자동 업데이트'}>
    {['downloading','ready','available'].includes(kind??'')?<Download aria-hidden size={12}/>:kind==='checking'?<RefreshCw aria-hidden size={12} className="animate-spin"/>:<span aria-hidden className={'desktop-update-dot '+(kind==='error'?'needs-attention':'')}/>}
    <span>{formatAppVersion(state?.version??__APP_RELEASE__)}</span>{badge&&<span role="status" aria-live="polite" className="desktop-update-label">{badge}</span>}
   </button>
   </div>
  </header>
  {windowError&&<p role="alert" style={{top:'var(--desktop-bar-height)'}} className="fixed inset-x-0 z-[75] bg-white px-3 py-2 text-xs text-red-600">{windowError}</p>}
  <div className="desktop-content">{children}</div>
  {progress&&createPortal(<div role="dialog" aria-modal="true" aria-label="업데이트 진행" className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-[rgba(52,40,35,0.30)]"><div className="w-full max-w-sm rounded-2xl border border-app-line bg-white p-6 shadow-xl text-center text-app-ink"><RefreshCw aria-hidden className="w-7 h-7 mx-auto mb-3 animate-spin text-app-accent"/><h2 className="font-bold">업데이트 중</h2><p className="text-xs text-app-muted mt-1">{formatAppVersion(state!.update.version)}</p><p role="status" aria-live="polite" className="mt-3 text-sm leading-6">{kind==='preparing'?'메모 저장을 확인하고 있어요.':'새 버전을 적용하고 있습니다. 완료되면 앱이 자동으로 다시 열립니다.'}</p></div></div>,document.body)}
  <UpdatesDialog open={open} state={state} error={error} onClose={()=>setOpen(false)} onRetry={()=>void read()}/>
 </div>;
}
