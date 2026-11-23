export interface DesktopFlush {waits:Promise<unknown>[]}
export function initializeDesktopLifecycle(){
 const api=window.miniallyDesktop;if(!api)return;
 api.onPrepareClose(async()=>{
  if(document.querySelector('[data-note-composing="true"]'))return false;
  if([...document.querySelectorAll('[role="dialog"][aria-modal="true"], [role="alertdialog"]')].some(element=>!['설정','앱 버전 및 업데이트'].includes(element.getAttribute('aria-label')||'')))return false;
  if([...document.querySelectorAll<HTMLInputElement>('[data-quick-title],input[aria-label="새 할 일 제목"]')].some(input=>input.value.trim()))return false;
  const detail:DesktopFlush={waits:[]};window.dispatchEvent(new CustomEvent<DesktopFlush>('minially:flush',{detail}));
  try{await Promise.all(detail.waits);return true;}catch{return false;}
 });
}
