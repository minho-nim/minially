import {useEffect,useRef,useState,type CSSProperties,type PointerEvent} from 'react';
const GAP=8;
const KEY='minially-note-pane-widths-v1';
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(value,Math.max(min,max)));
export function useNotePaneSizes(){
 const root=useRef<HTMLElement>(null),drag=useRef<{index:number;x:number;widths:[number,number];cursor:string;select:string}|null>(null);
 const [width,setWidth]=useState(1000),[preferred,setPreferred]=useState<[number,number]|null>(()=>{try{const value=JSON.parse(localStorage.getItem(KEY)||'null');return Array.isArray(value)&&value.length===2&&value.every(n=>Number.isFinite(n)&&n>=100&&n<=600)?value as [number,number]:null;}catch{return null;}});
 const defaults:[number,number]=width>=1100?[180,240]:[150,220];
 const folder=clamp(preferred?.[0]??defaults[0],120,Math.min(360,width-460-GAP*2)),list=clamp(preferred?.[1]??defaults[1],180,Math.min(520,width-folder-280-GAP*2));
 const widths:[number,number]=[folder,list];
 const save=(value:[number,number])=>{setPreferred(value);try{localStorage.setItem(KEY,JSON.stringify(value));}catch{/* 이번 창에서 폭 유지 */}};
 function finish(){const active=drag.current;if(!active)return;document.body.style.cursor=active.cursor;document.body.style.userSelect=active.select;drag.current=null;}
 useEffect(()=>{const element=root.current;if(!element)return;const update=()=>{if(element.clientWidth>0)setWidth(element.clientWidth);};update();const observer=new ResizeObserver(update);observer.observe(element);window.addEventListener('blur',finish);return()=>{observer.disconnect();window.removeEventListener('blur',finish);finish();};},[]);
 function start(event:PointerEvent,index:number){if(event.button!==0||!event.isPrimary)return;event.preventDefault();drag.current={index,x:event.clientX,widths,cursor:document.body.style.cursor,select:document.body.style.userSelect};document.body.style.cursor='col-resize';document.body.style.userSelect='none';event.currentTarget.setPointerCapture(event.pointerId);}
 function resize(index:number,value:number){const next:[number,number]=[...widths];next[index]=clamp(value,index===0?120:180,index===0?Math.min(360,width-list-280-GAP*2):Math.min(520,width-folder-280-GAP*2));save(next);}
 const reset=()=>{setPreferred(null);try{localStorage.removeItem(KEY);}catch{/* 기본 폭으로 복원 */}};
 function separator(index:number){return <div key={index} role="separator" tabIndex={0} aria-label={index===0?'메모 분류 폭 조절':'메모 목록 폭 조절'} aria-orientation="vertical" aria-valuemin={index===0?120:180} aria-valuemax={Math.max(index===0?120:180,index===0?Math.min(360,width-list-280-GAP*2):Math.min(520,width-folder-280-GAP*2))} aria-valuenow={widths[index]} className="note-pane-separator" style={{left:(index===0?folder:folder+GAP+list)+GAP/2-4}} title="드래그하여 폭 조절 · 두 번 누르면 기본 폭" onPointerDown={event=>start(event,index)} onPointerMove={event=>{const active=drag.current;if(active?.index===index)resize(index,active.widths[index]+event.clientX-active.x);}} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onDoubleClick={reset} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();resize(index,event.key==='Home'?0:event.key==='End'?10000:widths[index]+(event.key==='ArrowRight'?1:-1)*(event.shiftKey?30:10));}}}/>;}
 return {root,style:{'--notes-pane-gap':GAP+'px','--notes-folder-width':folder+'px','--notes-list-width':list+'px'} as CSSProperties,separator};
}
