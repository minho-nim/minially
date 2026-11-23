import {useState} from 'react';
import {RefreshCw} from 'lucide-react';
import type {DesktopState} from '../../desktop';
import {formatAppVersion} from '../../utils/appVersion';

export function DesktopUpdates({state}:{state:DesktopState}){
 const api=window.miniallyDesktop!,[busy,setBusy]=useState(false),[error,setError]=useState('');
 const update=state.update;
 async function run(action:()=>Promise<unknown>){if(busy)return;setBusy(true);setError('');try{await action();}catch{setError('열린 편집창과 저장 상태를 확인한 뒤 다시 시도해 주세요.');}finally{setBusy(false);}}
 const status=({unsupported:'설치형 Windows 앱에서 업데이트를 사용할 수 있어요.',idle:'앱 시작 시와 실행 중에 새 버전을 자동으로 확인해요.',checking:'새 버전을 확인하는 중…',current:'최신 버전입니다.',available:`새 버전 ${formatAppVersion(update.version)}을 받을 수 있어요.`,downloading:`다운로드 중 · ${Math.round(update.percent)}%`,ready:`${formatAppVersion(update.version)} 설치 준비가 끝났어요.`,preparing:'메모 저장을 확인하는 중…',installing:'새 버전을 적용하고 있습니다. 앱이 자동으로 다시 열립니다.',error:update.message||'업데이트를 확인하지 못했습니다.'})[update.kind];
 return <section aria-label="자동 업데이트" className="space-y-2">
  <div className="flex items-center justify-between gap-2"><h5 className="text-xs font-semibold">자동 업데이트</h5><span className="text-xs text-app-muted">{formatAppVersion(state.version)}</span></div>
  <label className="flex items-center justify-between min-h-9 gap-3 text-xs"><span>새 버전 자동 다운로드</span><input type="checkbox" aria-label="새 버전 자동 다운로드" checked={state.preferences.autoDownload} disabled={busy} onChange={event=>{const autoDownload=event.target.checked;void run(()=>api.updatePreferences({autoDownload}));}}/></label>
  <p role="status" aria-label="업데이트 상태" className="text-xs text-app-muted leading-5">{status}</p>
  {update.kind==='downloading'&&<progress aria-label="업데이트 다운로드 진행률" max={100} value={update.percent} className="w-full h-1.5 accent-app-accent"/>}
  <div className="flex flex-wrap gap-2"><button type="button" disabled={busy||['unsupported','checking','downloading','ready','preparing','installing'].includes(update.kind)} onClick={()=>void run(()=>api.checkUpdate())} className="min-h-9 px-3 rounded-lg border border-app-line text-xs flex gap-1 items-center"><RefreshCw className="w-3.5 h-3.5"/>업데이트 확인</button>{update.kind==='available'&&<button type="button" disabled={busy} onClick={()=>void run(()=>api.downloadUpdate())} className="min-h-9 px-3 rounded-lg bg-app-soft text-app-accent-hover text-xs">업데이트 다운로드</button>}{update.kind==='ready'&&<button type="button" disabled={busy} onClick={()=>void run(()=>api.installUpdate())} className="min-h-9 px-3 rounded-lg bg-app-accent text-white text-xs">저장 후 재시작</button>}</div>
  <p className="text-[11px] leading-5 text-app-muted">다운로드 중에도 계속 사용할 수 있어요. 작성 내용의 저장을 확인한 뒤 재시작해요.</p>
  {error&&<p role="alert" className="text-xs text-red-600">{error}</p>}
 </section>;
}
