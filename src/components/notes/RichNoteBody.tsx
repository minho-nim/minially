import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Bold,Italic,Underline,Strikethrough,RemoveFormatting,Superscript,Subscript,Undo2,Redo2,AlignLeft,AlignCenter,AlignRight,AlignJustify,List,ListOrdered,Table2,Highlighter,Baseline,type LucideIcon} from 'lucide-react';
import type {NoteBlock,NoteTextRun} from '../../types';
import {NOTE_FONTS,NOTE_SIZES,NOTE_LINE_HEIGHTS,flattenNoteBlocks} from '../../utils/noteRichDocument';
import {readNoteDocument,renderNoteDocument,renderNoteRuns} from './noteRichDom';
export {readNoteRuns} from './noteRichDom';
const formats=[['bold','굵게',Bold],['italic','기울임',Italic],['underline','밑줄',Underline],['strikeThrough','취소선',Strikethrough],['superscript','위첨자',Superscript],['subscript','아래첨자',Subscript]] as const;
const alignments=[['justifyLeft','왼쪽 정렬',AlignLeft],['justifyCenter','가운데 정렬',AlignCenter],['justifyRight','오른쪽 정렬',AlignRight],['justifyFull','양쪽 정렬',AlignJustify]] as const;
type EditorSnapshot={document:NoteBlock[];start:number;end:number};
const tool='w-8 h-8 shrink-0 flex items-center justify-center rounded-md cursor-pointer disabled:opacity-30 disabled:cursor-default';
function Tool({label,icon:Icon,onClick,pressed,disabled}:{label:string;icon:LucideIcon;onClick:()=>void;pressed?:boolean;disabled?:boolean}){
 return <button type="button" aria-label={label} title={label} aria-pressed={pressed} disabled={disabled} onPointerDown={event=>event.preventDefault()} onClick={onClick} className={tool+' '+(pressed?'bg-app-soft text-app-accent-hover':'text-app-muted hover:bg-app-canvas')}><Icon aria-hidden="true" className="w-4 h-4"/></button>;
}
export function RichNoteBody({body,runs,blocks,readOnly,onChange}:{body:string;runs?:NoteTextRun[];blocks?:NoteBlock[];readOnly:boolean;onChange:(body:string,runs:NoteTextRun[],blocks:NoteBlock[])=>void}){
 const ref=useRef<HTMLDivElement>(null),range=useRef<Range|null>(null),cell=useRef<HTMLTableCellElement|null>(null),lastValue=useRef('');
 const snapshots=useRef<EditorSnapshot[]>([]),position=useRef(0),executing=useRef(false),composing=useRef(false);
 const [active,setActive]=useState<Record<string,boolean>>({}),[font,setFont]=useState<string>(NOTE_FONTS[0]),[size,setSize]=useState(12),[lineHeight,setLineHeight]=useState(1.8),[tableOpen,setTableOpen]=useState(false),[rows,setRows]=useState(3),[columns,setColumns]=useState(3),[inTable,setInTable]=useState(false),[history,setHistory]=useState({undo:false,redo:false});
 const remember=()=>{
  const selection=window.getSelection(),root=ref.current;if(!root||!selection?.rangeCount||!root.contains(selection.anchorNode)||!root.contains(selection.focusNode))return;
  range.current=selection.getRangeAt(0).cloneRange();setActive(Object.fromEntries([...formats,...alignments,['insertUnorderedList'],['insertOrderedList']].map(([command])=>[command,document.queryCommandState(command)])));
  setHistory({undo:position.current>0,redo:position.current<snapshots.current.length-1});
  const element=selection.anchorNode instanceof HTMLElement?selection.anchorNode:selection.anchorNode?.parentElement;const selectedCell=element?.closest('td,th');cell.current=selectedCell&&root.contains(selectedCell)?selectedCell as HTMLTableCellElement:null;setInTable(!!cell.current);
  if(element){const style=getComputedStyle(element),family=style.fontFamily.split(',')[0].replace(/["']/g,'').trim();if((NOTE_FONTS as readonly string[]).includes(family))setFont(family);const pt=parseFloat(style.fontSize)*.75;if(pt>=8&&pt<=72)setSize(Math.round(pt*10)/10);}
 };
 useEffect(()=>{document.addEventListener('selectionchange',remember);return()=>document.removeEventListener('selectionchange',remember);},[]);
 useLayoutEffect(()=>{const root=ref.current;if(!root)return;const key=JSON.stringify([body,runs,blocks]);if(lastValue.current===key)return;if(blocks)renderNoteDocument(root,blocks);else renderNoteRuns(root,runs??[{text:body}]);lastValue.current=key;range.current=null;cell.current=null;setInTable(false);snapshots.current=[{document:readNoteDocument(root),start:0,end:0}];position.current=0;setHistory({undo:false,redo:false});},[body,runs,blocks]);
 function bookmark(){
  const root=ref.current!,selected=window.getSelection();if(!selected?.rangeCount||!root.contains(selected.anchorNode)||!root.contains(selected.focusNode))return {start:0,end:0};
  const selectedRange=selected.getRangeAt(0),prefix=document.createRange();prefix.selectNodeContents(root);prefix.setEnd(selectedRange.startContainer,selectedRange.startOffset);const start=prefix.toString().length;return {start,end:start+selectedRange.toString().length};
 }
 function emit(){
  if(executing.current)return;const root=ref.current;if(!root)return;const document=readNoteDocument(root),next=flattenNoteBlocks(document),text=next.map(run=>run.text).join('');
  const snapshot={document,...bookmark()};
  if(!composing.current){if(JSON.stringify(snapshots.current[position.current]?.document)!==JSON.stringify(document)){snapshots.current=snapshots.current.slice(0,position.current+1);snapshots.current.push(snapshot);if(snapshots.current.length>100)snapshots.current.shift();position.current=snapshots.current.length-1;}else if(snapshots.current[position.current])Object.assign(snapshots.current[position.current],bookmark());}
  lastValue.current=JSON.stringify([text,next,document]);onChange(text,next,document);remember();
 }
 function travel(direction:-1|1){
  const root=ref.current,target=position.current+direction;if(!root||readOnly||target<0||target>=snapshots.current.length)return;position.current=target;const snapshot=snapshots.current[target];renderNoteDocument(root,snapshot.document);root.focus({preventScroll:true});
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes:Text[]=[];while(walker.nextNode())nodes.push(walker.currentNode as Text);
  const point=(offset:number):[Node,number]=>{for(const node of nodes){if(offset<=node.length)return [node,offset];offset-=node.length;}return nodes.length?[nodes[nodes.length-1],nodes[nodes.length-1].length]:[root,0];};
  const nextRange=document.createRange(),[startNode,startOffset]=point(snapshot.start),[endNode,endOffset]=point(snapshot.end);nextRange.setStart(startNode,startOffset);nextRange.setEnd(endNode,endOffset);const selected=window.getSelection();selected?.removeAllRanges();selected?.addRange(nextRange);range.current=nextRange.cloneRange();
  const runs=flattenNoteBlocks(snapshot.document),text=runs.map(run=>run.text).join('');lastValue.current=JSON.stringify([text,runs,snapshot.document]);onChange(text,runs,snapshot.document);remember();
 }

 function restore(){const root=ref.current;if(!root||readOnly)return null;root.focus({preventScroll:true});const selection=window.getSelection();if(range.current&&root.contains(range.current.commonAncestorContainer)){selection?.removeAllRanges();selection?.addRange(range.current);}else{const end=document.createRange();end.selectNodeContents(root);end.collapse(false);selection?.removeAllRanges();selection?.addRange(end);}return root;}
 function command(name:string,value?:string,after?:()=>void){if(name==='undo'){travel(-1);return;}if(name==='redo'){travel(1);return;}if(!restore())return;executing.current=true;try{document.execCommand(name,false,value);after?.();}finally{executing.current=false;}emit();}
 function fontSize(value:number){if(!Number.isFinite(value)||value<8||value>72)return;command('fontSize','7',()=>{for(const element of ref.current!.querySelectorAll<HTMLElement>('font[size="7"]')){element.removeAttribute('size');element.style.fontSize=value+'pt';}});setSize(value);}
 function spacing(value:number){
  if(!restore())return;const node=window.getSelection()?.anchorNode;let element=(node instanceof HTMLElement?node:node?.parentElement)?.closest('p,li,div,td,th') as HTMLElement|null;
  if(!element||element===ref.current){document.execCommand('formatBlock',false,'p');const node=window.getSelection()?.anchorNode;element=(node instanceof HTMLElement?node:node?.parentElement)?.closest('p')||null;}
  if(!element||!ref.current!.contains(element))return;const clone=element.cloneNode(true) as HTMLElement;clone.style.lineHeight=String(value);const selection=window.getSelection(),replace=document.createRange();replace.selectNode(element);selection?.removeAllRanges();selection?.addRange(replace);document.execCommand('insertHTML',false,clone.outerHTML);setLineHeight(value);emit();
 }
 function selectCell(table:HTMLTableElement,row=0,column=0){const targetRow=table.rows[Math.min(row,table.rows.length-1)],target=targetRow?.cells[Math.min(column,targetRow.cells.length-1)];if(!target)return;const selection=window.getSelection(),next=document.createRange();next.selectNodeContents(target);next.collapse(true);selection?.removeAllRanges();selection?.addRange(next);range.current=next.cloneRange();remember();}
 function insertTable(){
  if(!Number.isInteger(rows)||!Number.isInteger(columns)||rows<1||columns<1||rows>20||columns>20)return;
  const wrapper=document.createElement('div');renderNoteDocument(wrapper,[{type:'table',rows:Array.from({length:rows},()=>Array.from({length:columns},()=>({runs:[]})))},{type:'paragraph',runs:[]}]);const marker='table-'+crypto.randomUUID();wrapper.querySelector('table')!.setAttribute('data-new-table',marker);
  command('insertHTML',wrapper.innerHTML,()=>{const table=ref.current!.querySelector<HTMLTableElement>(`[data-new-table="${marker}"]`);if(table){table.removeAttribute('data-new-table');selectCell(table);}});setTableOpen(false);
 }
 function editTable(action:'row'|'column'|'deleteRow'|'deleteColumn'|'deleteTable'){
  if(!restore())return;const current=cell.current,table=current?.closest('table');if(!current||!table||!ref.current!.contains(table))return;const row=(current.parentElement as HTMLTableRowElement).rowIndex,column=current.cellIndex,clone=table.cloneNode(true) as HTMLTableElement;
  if(action==='row'){if(clone.rows.length>=20)return;const added=clone.insertRow(row+1);for(let i=0;i<clone.rows[0].cells.length;i++)added.insertCell().appendChild(document.createElement('br'));}
  if(action==='column'){if(clone.rows[0].cells.length>=20)return;for(const r of clone.rows)r.insertCell(column+1).appendChild(document.createElement('br'));}
  if(action==='deleteRow')clone.deleteRow(row);
  if(action==='deleteColumn')for(const r of clone.rows)r.deleteCell(column);
  const selection=window.getSelection(),replace=document.createRange();replace.selectNode(table);selection?.removeAllRanges();selection?.addRange(replace);
  if(action==='deleteTable'||!clone.rows.length||!clone.rows[0].cells.length)document.execCommand('delete');
  else {const marker='table-'+crypto.randomUUID();clone.setAttribute('data-new-table',marker);document.execCommand('insertHTML',false,clone.outerHTML);const inserted=ref.current!.querySelector<HTMLTableElement>(`[data-new-table="${marker}"]`);if(inserted){inserted.removeAttribute('data-new-table');selectCell(inserted,row+(action==='row'?1:0),column+(action==='column'?1:0));}}
  emit();
 }
 return <div className="flex-1 min-h-56 flex flex-col min-w-0">
  {!readOnly&&<div role="toolbar" aria-label="메모 글자 서식" className="note-format-toolbar border-y border-app-line px-3 py-1">
   <div className="overflow-x-auto"><div className="flex items-center gap-1 min-w-max">
    <Tool label="실행 취소" icon={Undo2} disabled={!history.undo} onClick={()=>command('undo')}/><Tool label="다시 실행" icon={Redo2} disabled={!history.redo} onClick={()=>command('redo')}/>
    <select aria-label="글꼴" value={font} onChange={e=>{setFont(e.target.value);command('fontName',e.target.value);}} className="note-format-select w-28">{NOTE_FONTS.map(name=><option key={name}>{name}</option>)}</select>
    <select aria-label="글자 크기" value={size} onChange={e=>fontSize(Number(e.target.value))} className="note-format-select w-[68px]">{!NOTE_SIZES.includes(size)&&<option value={size}>{size}pt</option>}{NOTE_SIZES.map(value=><option key={value} value={value}>{value}pt</option>)}</select>
    <select aria-label="줄간격" value={lineHeight} onChange={e=>spacing(Number(e.target.value))} className="note-format-select w-24">{NOTE_LINE_HEIGHTS.map(value=><option key={value} value={value}>줄간격 {Math.round(value*100)}%</option>)}</select>
    <button type="button" aria-label="표" aria-expanded={tableOpen} onPointerDown={e=>e.preventDefault()} onClick={()=>setTableOpen(!tableOpen)} className={tool+' text-app-muted hover:bg-app-soft'} title="표"><Table2 aria-hidden="true" className="w-4 h-4"/></button>
   </div></div>
   <div className="overflow-x-auto"><div className="flex items-center gap-0.5 min-w-max">
    {formats.map(([name,label,icon])=><Tool key={name} label={label} icon={icon} pressed={!!active[name]} onClick={()=>command(name)}/>)}
    <label className={tool+' relative text-app-muted hover:bg-app-soft'} title="글자색"><Baseline aria-hidden="true" className="w-4 h-4"/><input type="color" aria-label="글자색" defaultValue="#3e3438" onChange={e=>command('foreColor',e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/></label>
    <label className={tool+' relative text-app-muted hover:bg-app-soft'} title="강조색"><Highlighter aria-hidden="true" className="w-4 h-4"/><input type="color" aria-label="강조색" defaultValue="#fff2a8" onChange={e=>command('hiliteColor',e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/></label>
    <span aria-hidden="true" className="h-4 mx-1 border-r border-app-line"/>{alignments.map(([name,label,icon])=><Tool key={name} label={label} icon={icon} pressed={!!active[name]} onClick={()=>command(name)}/>)}
    <Tool label="글머리 기호" icon={List} pressed={!!active.insertUnorderedList} onClick={()=>command('insertUnorderedList')}/><Tool label="번호 목록" icon={ListOrdered} pressed={!!active.insertOrderedList} onClick={()=>command('insertOrderedList')}/><Tool label="서식 지우기" icon={RemoveFormatting} onClick={()=>command('removeFormat')}/>
   </div></div>
   {tableOpen&&<fieldset aria-label="표 만들기" className="flex flex-wrap gap-2 items-center py-2 text-xs"><label>행 <input aria-label="표 행 수" type="number" min={1} max={20} value={rows} onChange={e=>setRows(Number(e.target.value))} className="w-14 border border-app-line rounded px-1 min-h-8"/></label><label>열 <input aria-label="표 열 수" type="number" min={1} max={20} value={columns} onChange={e=>setColumns(Number(e.target.value))} className="w-14 border border-app-line rounded px-1 min-h-8"/></label><button type="button" onClick={insertTable} disabled={!Number.isInteger(rows)||!Number.isInteger(columns)||rows<1||columns<1||rows>20||columns>20} className="min-h-8 px-2 rounded bg-app-soft text-app-accent-hover disabled:opacity-40">표 삽입</button></fieldset>}
   {inTable&&<div role="group" aria-label="표 편집" className="flex flex-wrap gap-1 py-1">{([['row','아래에 행 추가'],['column','오른쪽에 열 추가'],['deleteRow','행 삭제'],['deleteColumn','열 삭제'],['deleteTable','표 삭제']] as const).map(([action,label])=><button key={action} type="button" onPointerDown={e=>e.preventDefault()} onClick={()=>editTable(action)} className="min-h-8 px-2 text-[11px] rounded text-app-muted hover:bg-app-soft">{label}</button>)}</div>}
  </div>}
  <div ref={ref} role="textbox" aria-label="메모 본문" aria-multiline="true" aria-readonly={readOnly} contentEditable={!readOnly} suppressContentEditableWarning spellCheck data-placeholder="자유롭게 적으세요. 짧은 생각도, 긴 기록도 좋아요." className="note-rich-body flex-1 min-h-48 w-full min-w-0 px-3 py-2 text-sm leading-7 outline-none bg-transparent overflow-auto" onInput={emit} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;emit();}} onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&!event.nativeEvent.isComposing){const key=event.key.toLowerCase();if(key==='z'||key==='y'){event.preventDefault();event.stopPropagation();travel(key==='y'||event.shiftKey?1:-1);}}}} onKeyUp={remember} onMouseUp={remember} onPaste={event=>{
   if(readOnly)return;event.preventDefault();const html=event.clipboardData.getData('text/html');if(html){const parsed=document.createElement('template');parsed.innerHTML=html;const safe=document.createElement('div');const pasted=readNoteDocument(parsed.content);if(pasted.length===1&&pasted[0].type==='paragraph'&&!pasted[0].align&&!pasted[0].list&&!pasted[0].indent&&!pasted[0].lineHeight)renderNoteRuns(safe,pasted[0].runs);else renderNoteDocument(safe,pasted);document.execCommand('insertHTML',false,safe.innerHTML);}else document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));emit();
  }} onDrop={event=>event.preventDefault()}/>
 </div>;
}
