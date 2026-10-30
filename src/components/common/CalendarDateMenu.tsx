import {useEffect,useLayoutEffect,useRef,useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';

export function CalendarDateMenu({anchor,onClose,children}:{anchor:HTMLButtonElement|null;onClose:()=>void;children:ReactNode}) {
 const root=useRef<HTMLDivElement>(null);
 const [position,setPosition]=useState({left:8,top:8,maxHeight:200,ready:false});
 useLayoutEffect(()=>{
  if(!anchor)return;
  const place=()=>{
   const menu=root.current;if(!menu||!anchor.isConnected)return;
   const viewport=window.visualViewport,top=(viewport?.offsetTop||0)+8,left=(viewport?.offsetLeft||0)+8;
   const right=(viewport?.offsetLeft||0)+(viewport?.width||innerWidth)-8;
   let bottom=(viewport?.offsetTop||0)+(viewport?.height||innerHeight)-8;
   const nav=document.querySelector<HTMLElement>('nav[aria-label="하단 메뉴"]');
   if(nav&&getComputedStyle(nav).display!=='none'){const bounds=nav.getBoundingClientRect();if(bounds.top>top&&bounds.top<bottom)bottom=bounds.top-8;}
   const bounds=anchor.getBoundingClientRect(),width=menu.getBoundingClientRect().width,height=Math.min(menu.scrollHeight+2,bottom-top);
   const preferred=bounds.bottom+6+height<=bottom?bounds.bottom+6:bounds.top-height-6;
   setPosition({left:Math.max(left,Math.min(bounds.right-width,right-width)),top:Math.max(top,Math.min(preferred,bottom-height)),maxHeight:Math.max(44,bottom-top),ready:true});
  };
  place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  const viewport=window.visualViewport;viewport?.addEventListener('resize',place);viewport?.addEventListener('scroll',place);
  return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);viewport?.removeEventListener('resize',place);viewport?.removeEventListener('scroll',place);};
 },[anchor]);
 useEffect(()=>{
  const outside=(event:MouseEvent)=>{if(root.current?.contains(event.target as Node)||anchor?.contains(event.target as Node))return;event.preventDefault();event.stopPropagation();onClose();};
  const escape=(event:KeyboardEvent)=>{if(event.key!=='Escape')return;event.preventDefault();event.stopPropagation();onClose();anchor?.focus({preventScroll:true});};
  document.addEventListener('click',outside,true);document.addEventListener('keydown',escape,true);
  return()=>{document.removeEventListener('click',outside,true);document.removeEventListener('keydown',escape,true);};
 },[anchor,onClose]);
 if(!anchor)return null;
 return createPortal(<div ref={root} role="group" aria-label="날짜 작업 메뉴" onClick={event=>event.stopPropagation()} className="calendar-date-menu fixed z-[60] w-44 max-w-[calc(100vw-16px)] overflow-y-auto overscroll-contain bg-white rounded-xl shadow-lg border border-[#F0E7EB] py-1 text-xs" style={{left:position.left,top:position.top,maxHeight:position.maxHeight,visibility:position.ready?'visible':'hidden'}}>{children}</div>,document.body);
}
