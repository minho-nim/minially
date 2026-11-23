import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent, KeyboardEvent, RefObject } from 'react';

function savedHeight(key:string,fallback:number) {
 try {const value=Number(localStorage.getItem(key));return Number.isFinite(value)&&value>=.45&&value<=.92?value:fallback;}catch{return fallback;}
}

export function useMobileSheet<T extends HTMLElement = HTMLDivElement>(open: boolean, initialRatio = .62, kind = 'day') {
 const storageKey='minially:sheet-height:'+kind;
 const surfaceRef = useRef<T>(null);
 const [mobile,setMobile] = useState(()=>matchMedia('(max-width: 639px)').matches);
 const [ratio,setRatio] = useState(()=>savedHeight(storageKey,initialRatio));
 const drag = useRef<{y:number;height:number;available:number}|null>(null), moved = useRef(false);
 useEffect(()=>{const media=matchMedia('(max-width: 639px)'),change=()=>setMobile(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 useLayoutEffect(()=>{if(open){setRatio(savedHeight(storageKey,initialRatio));drag.current=null;moved.current=false;}},[open,initialRatio,storageKey]);
 const expand = useCallback(()=>{if(matchMedia('(max-width: 639px)').matches)setRatio(.92);},[]);
 const clamp = (value:number)=>Math.max(.45,Math.min(.92,value));
 const resize = (value:number)=>{const next=clamp(value);setRatio(next);try{localStorage.setItem(storageKey,String(next));}catch{/* Resizing still works when storage is unavailable. */}};
 const handleProps = {
  type:'button' as const, role:'slider' as const, 'aria-label':'팝업 높이 조절', 'aria-orientation':'vertical' as const, 'aria-valuemin':45,'aria-valuemax':92,'aria-valuenow':Math.round(ratio*100),
  title:'위아래로 끌거나 방향키로 높이를 조절하세요',
  style:{touchAction:'none'} as CSSProperties,
  onPointerDown:(e:PointerEvent<HTMLButtonElement>)=>{if(!mobile||e.button!==0)return;e.preventDefault();const surface=surfaceRef.current,overlay=surface?.closest<HTMLElement>('[aria-modal="true"]');if(!surface)return;drag.current={y:e.clientY,height:surface.getBoundingClientRect().height,available:overlay?.getBoundingClientRect().height||innerHeight};moved.current=false;e.currentTarget.setPointerCapture(e.pointerId);},
  onPointerMove:(e:PointerEvent<HTMLButtonElement>)=>{const start=drag.current;if(!start)return;if(Math.abs(e.clientY-start.y)>4)moved.current=true;if(moved.current){e.preventDefault();resize((start.height+start.y-e.clientY)/start.available);}},
  onPointerUp:(e:PointerEvent<HTMLButtonElement>)=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);},
  onPointerCancel:()=>{drag.current=null;moved.current=false;},
  onClick:()=>{if(moved.current){moved.current=false;return;}resize(ratio>=.9?initialRatio:.92);},
  onKeyDown:(e:KeyboardEvent<HTMLButtonElement>)=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();resize(e.key==='Home'?.45:e.key==='End'?.92:ratio+(e.key==='ArrowUp'?.05:-.05));},
 };
 const style:CSSProperties|undefined=mobile?{height:'calc(var(--modal-height, 100dvh) * '+ratio+')',minHeight:'min(280px, calc(var(--modal-height, 100dvh) * .92))',maxHeight:'calc(var(--modal-height, 100dvh) - env(safe-area-inset-top, 0px) - 12px)'}:undefined;
 return {surfaceRef,style,handleProps,expand};
}

// Expand first, then reveal the picker after layout/keyboard changes settle.
export function useRevealSheetPanel(active:boolean,root:RefObject<HTMLDivElement|null>,expand:()=>void) {
 useEffect(()=>{
  if(!active)return;expand();
  const focused=document.activeElement;if(focused instanceof HTMLInputElement||focused instanceof HTMLTextAreaElement)focused.blur();
  let frame=0;
  const reveal=()=>{
   const focused=document.activeElement;
   const editing=focused instanceof HTMLInputElement||focused instanceof HTMLTextAreaElement||focused instanceof HTMLSelectElement;
   const target=editing&&root.current?.contains(focused)?focused:root.current?.querySelector<HTMLElement>('[data-inline-presets]');
   const scroll=target?.closest<HTMLElement>('[data-sheet-scroll]');
   if(!target||!scroll)return;
   const a=target.getBoundingClientRect(),b=scroll.getBoundingClientRect();
   if(a.height>b.height||a.top<b.top)scroll.scrollTop+=a.top-b.top-4;
   else if(a.bottom>b.bottom)scroll.scrollTop+=a.bottom-b.bottom+4;
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(reveal);});};
  schedule();const viewport=window.visualViewport;viewport?.addEventListener('resize',schedule);
  return()=>{cancelAnimationFrame(frame);viewport?.removeEventListener('resize',schedule);};
 },[active,root,expand]);
}
