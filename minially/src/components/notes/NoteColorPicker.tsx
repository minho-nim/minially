import {useState,type ReactNode} from 'react';
import {THEME_COLORS,STANDARD_COLORS,colorShade} from '../../utils/noteFormatting';
interface Props {label:string;value:string;onChange:(color:string|undefined)=>void;allowNone?:boolean;icon?:ReactNode;disabled?:boolean}
export function NoteColorPicker({label,value,onChange,allowNone,icon,disabled}:Props){
 const [open,setOpen]=useState(false);
 const choose=(color:string|undefined)=>{onChange(color);setOpen(false);};
 const swatch=(color:string,key:string)=><button key={key} type="button" aria-label={`${label} ${color}`} title={color} aria-pressed={value.toLowerCase()===color} onPointerDown={event=>event.preventDefault()} onClick={()=>choose(color)} className="min-w-0 h-8 p-1 rounded hover:bg-app-soft focus-visible:outline-app-accent"><span className="block w-full h-full rounded-sm border border-black/10" style={{backgroundColor:color}}/></button>;
 return <div className={icon?'contents':'min-w-0'}><button type="button" disabled={disabled} aria-label={label+' 선택'} aria-expanded={open} onPointerDown={event=>event.preventDefault()} onClick={()=>setOpen(!open)} className={icon?'w-8 h-8 flex flex-col items-center justify-center rounded-md text-app-muted hover:bg-app-soft':'min-h-9 w-full px-2 rounded-lg border border-app-line flex items-center gap-2 text-sm bg-app-canvas'}>{icon||label}<span aria-hidden className={icon?'w-4 h-0.5 rounded':'w-4 h-4 rounded border border-black/10'} style={{backgroundColor:value}}/></button>
 {open&&<div role="group" aria-label={label+' 팔레트'} className="basis-full w-full max-w-sm p-2 rounded-xl border border-app-line bg-white text-app-ink space-y-1">
  <div className="flex justify-between items-center text-xs font-semibold"><span>테마 색</span><button type="button" aria-label={label+' 팔레트 닫기'} onClick={()=>setOpen(false)} className="min-h-8 px-2 text-app-muted">닫기</button></div>
  <div className="grid grid-cols-8">{[0.8,0.5,0,-0.25,-0.5].flatMap((ratio,row)=>THEME_COLORS.map((color,column)=>swatch(colorShade(color,ratio),`${row}-${column}`)))}</div>
  <p className="text-xs font-semibold pt-1">표준 색</p><div className="grid grid-cols-10">{STANDARD_COLORS.map(color=>swatch(color,color))}</div>
  <div className="flex items-center flex-wrap gap-2 pt-1 text-xs">{allowNone&&<button type="button" onPointerDown={event=>event.preventDefault()} onClick={()=>choose(undefined)} className="min-h-8 px-2 rounded-lg hover:bg-app-soft">색 없음</button>}<label className="inline-flex items-center gap-2 min-h-8 px-2">다른 색<input type="color" aria-label={label} value={value} disabled={disabled} onChange={event=>onChange(event.target.value)} className="w-9 h-7 cursor-pointer"/></label><span className="text-app-muted">{value.toUpperCase()}</span></div>
 </div>}
 </div>;
}
