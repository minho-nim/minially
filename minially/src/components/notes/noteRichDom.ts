import type {NoteAlignment,NoteBlock,NoteParagraph,NoteTextRun} from '../../types';
import {NOTE_FONTS,NOTE_LINE_HEIGHTS,flattenNoteBlocks} from '../../utils/noteRichDocument';
const dropped=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','IMG','VIDEO','AUDIO','TEMPLATE','NOSCRIPT']);
const blockTags=new Set(['DIV','P','LI','BLOCKQUOTE','H1','H2','H3','H4','PRE']);
const photoOf=(node:Node)=>node instanceof HTMLElement&&node.tagName==='FIGURE'&&/^[0-9a-f-]{36}$/.test(node.dataset.photoId||'')?node.dataset.photoId!:null;
const structural=(node:Node)=>node instanceof HTMLElement&&(blockTags.has(node.tagName)||['TABLE','UL','OL'].includes(node.tagName)||!!photoOf(node));
/** 메모 사진 불러오기(사진 번호 → data URL). 메모 화면이 등록한다. 없으면 빈 칸으로 보인다. */
let photoLoader:((id:string)=>Promise<string|undefined>)|null=null;
export function setNotePhotoLoader(loader:typeof photoLoader){photoLoader=loader;}
export function notePhotoFigure(photoId:string,src?:string){
 const figure=document.createElement('figure');figure.className='note-photo';figure.contentEditable='false';figure.dataset.photoId=photoId;
 const img=document.createElement('img');img.alt='메모 사진';img.draggable=false;
 // 다른 기기에서 메모가 사진보다 먼저 도착할 수 있어 잠깐씩 다시 찾는다. shortcut: 최대 5번(10초), 그 뒤엔 메모를 다시 열면 보인다.
 const load=(tries:number)=>{void photoLoader?.(photoId).then(url=>{if(url)img.src=url;else if(tries>0&&img.isConnected!==false)setTimeout(()=>load(tries-1),2000);});};
 if(src)img.src=src;else load(5);
 figure.appendChild(img);return figure;
}
type Marks=Omit<NoteTextRun,'text'>;
function hex(value:string):string|undefined{
 if(/^#[0-9a-f]{6}$/i.test(value))return value.toLowerCase();const rgb=value.match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)(?:\s*[,/]\s*1)?\s*\)$/);return rgb?'#'+rgb.slice(1,4).map(n=>Math.min(255,Number(n)).toString(16).padStart(2,'0')).join(''):undefined;
}
function marksOf(node:HTMLElement,previous:Marks):Marks{
 const next={...previous},style=node.style;
 if(['B','STRONG'].includes(node.tagName)||['bold','bolder','600','700','800','900'].includes(style.fontWeight))next.bold=true;
 if(['I','EM'].includes(node.tagName)||style.fontStyle==='italic')next.italic=true;
 const decoration=style.textDecorationLine||style.textDecoration;
 if(node.tagName==='U'||decoration.includes('underline'))next.underline=true;
 if(['S','STRIKE','DEL'].includes(node.tagName)||decoration.includes('line-through'))next.strike=true;
 if(node.tagName==='SUP'||style.verticalAlign==='super')next.script='super';
 if(node.tagName==='SUB'||style.verticalAlign==='sub')next.script='sub';
 const family=(style.fontFamily||node.getAttribute('face')||'').split(',')[0].replace(/["']/g,'').trim();
 if((NOTE_FONTS as readonly string[]).includes(family))next.fontFamily=family;
 let size=parseFloat(style.fontSize);if(style.fontSize.endsWith('px'))size*=.75;
 if(!style.fontSize&&node.hasAttribute('size'))size=[0,8,10,12,14,18,24,36][Number(node.getAttribute('size'))]||0;
 if(Number.isFinite(size)&&size>=8&&size<=72)next.fontSize=Math.round(size*10)/10;
 const color=hex(style.color||node.getAttribute('color')||''),highlight=hex(style.backgroundColor);
 if(color)next.color=color;if(highlight)next.highlight=highlight;else if(style.backgroundColor==='transparent'||/rgba\(.+,\s*0\)/.test(style.backgroundColor))delete next.highlight;
 return next;
}
function readInline(nodes:Iterable<Node>,initial:Marks={}):NoteTextRun[]{
 const result:NoteTextRun[]=[];
 const append=(text:string,marks:Marks={})=>{if(!text)return;const last=result.at(-1);const key=(run:NoteTextRun|Marks)=>JSON.stringify(Object.entries(run).filter(([name])=>name!=='text').sort(([a],[b])=>a.localeCompare(b)));if(last&&key(last)===key(marks))last.text+=text;else result.push({text,...marks});};
 const visit=(node:Node,marks:Marks)=>{
  if(node.nodeType===Node.TEXT_NODE){append(node.textContent||'',marks);return;}
  if(!(node instanceof HTMLElement)||dropped.has(node.tagName))return;
  if(node.tagName==='BR'){if(node.parentNode?.childNodes.length!==1)append('\n');return;}
  const block=blockTags.has(node.tagName);if(block&&result.length&&!result.at(-1)?.text.endsWith('\n'))append('\n');
  const next=marksOf(node,marks);for(const child of node.childNodes)visit(child,next);
  if(block&&node.nextSibling&&!result.at(-1)?.text.endsWith('\n'))append('\n');
 };
 for(const node of nodes)visit(node,initial);return result;
}
function paragraphStyle(node:HTMLElement,base:Partial<NoteParagraph>={}):Partial<NoteParagraph>{
 const out={...base};const align=(node.style.textAlign||node.getAttribute('align')||'').replace('start','left').replace('end','right');if(['left','center','right','justify'].includes(align))out.align=align as NoteAlignment;
 let height=parseFloat(node.style.lineHeight);if(node.style.lineHeight.endsWith('%'))height/=100;if(NOTE_LINE_HEIGHTS.includes(height))out.lineHeight=height;
 const indent=parseFloat(node.style.marginLeft)/24;if(Number.isFinite(indent))out.indent=Math.max(0,Math.min(4,Math.round(indent)));
 return out;
}
export function readNoteDocument(root:HTMLElement|DocumentFragment,inherited:Partial<NoteParagraph>={}):NoteBlock[]{
 const result:NoteBlock[]=[],buffer:Node[]=[];
 const flush=()=>{if(buffer.length){result.push({type:'paragraph',runs:readInline(buffer),...inherited});buffer.length=0;}};
 for(const node of root.childNodes){
  if(node instanceof HTMLElement&&dropped.has(node.tagName))continue;
  if(!structural(node)){buffer.push(node);continue;}
  flush();const element=node as HTMLElement;
  const photoId=photoOf(element);if(photoId){result.push({type:'image',photoId});continue;}
  if(element.tagName==='TABLE'){
   const rows=Array.from((element as HTMLTableElement).rows).slice(0,20).map(row=>Array.from(row.cells).slice(0,20).map(cell=>({runs:readInline(cell.childNodes,marksOf(cell,{})),...((paragraphStyle(cell).align)?{align:paragraphStyle(cell).align}:{})})));
   const columns=Math.max(0,...rows.map(row=>row.length));if(columns){for(const row of rows)while(row.length<columns)row.push({runs:[]});result.push({type:'table',rows});}continue;
  }
  if(element.tagName==='UL'||element.tagName==='OL'){
   for(const li of element.children)if(li instanceof HTMLElement&&li.tagName==='LI')result.push({type:'paragraph',runs:readInline(li.childNodes,marksOf(li,{})),...paragraphStyle(li,inherited),list:element.tagName==='UL'?'bullet':'number'});continue;
  }
  const meta=paragraphStyle(element,inherited);
  if(element.tagName==='BLOCKQUOTE')meta.indent=Math.min(4,(meta.indent||0)+1);
  if(Array.from(element.childNodes).some(structural))result.push(...readNoteDocument(element,meta));
  else result.push({type:'paragraph',runs:readInline(element.childNodes,marksOf(element,{})),...meta});
 }
 flush();return result;
}
export function readNoteRuns(root:HTMLElement|DocumentFragment):NoteTextRun[]{return flattenNoteBlocks(readNoteDocument(root));}
function appendRuns(root:HTMLElement,runs:NoteTextRun[]){
 for(const run of runs){let node:Node=document.createTextNode(run.text);for(const [enabled,tag] of [[run.bold,'strong'],[run.italic,'em'],[run.underline,'u'],[run.strike,'s'],[run.script==='super','sup'],[run.script==='sub','sub']] as const){if(enabled){const wrapper=document.createElement(tag);wrapper.appendChild(node);node=wrapper;}}
  if(run.fontFamily||run.fontSize||run.color||run.highlight){const span=document.createElement('span');if(run.fontFamily)span.style.fontFamily=run.fontFamily;if(run.fontSize)span.style.fontSize=run.fontSize+'pt';if(run.color)span.style.color=run.color;if(run.highlight)span.style.backgroundColor=run.highlight;span.appendChild(node);node=span;}root.appendChild(node);
 }
}
export function renderNoteDocument(root:HTMLElement,blocks:NoteBlock[]){
 root.replaceChildren();let list:HTMLElement|null=null,lastList='';
 for(const block of blocks){
  if(block.type==='image'){list=null;lastList='';root.appendChild(notePhotoFigure(block.photoId));continue;}
  if(block.type==='table'){
   list=null;lastList='';const table=document.createElement('table'),body=document.createElement('tbody');table.appendChild(body);
   for(const row of block.rows){const tr=document.createElement('tr');for(const cell of row){const td=document.createElement('td');if(cell.align)td.style.textAlign=cell.align;appendRuns(td,cell.runs);if(!td.childNodes.length)td.appendChild(document.createElement('br'));tr.appendChild(td);}body.appendChild(tr);}root.appendChild(table);continue;
  }
  let element:HTMLElement;
  if(block.list){const key=block.list+':'+(block.indent||0);if(!list||key!==lastList){list=document.createElement(block.list==='bullet'?'ul':'ol');lastList=key;root.appendChild(list);}element=document.createElement('li');list.appendChild(element);}
  else {list=null;lastList='';element=document.createElement('p');root.appendChild(element);}
  if(block.align)element.style.textAlign=block.align;if(block.lineHeight)element.style.lineHeight=String(block.lineHeight);if(block.indent)element.style.marginLeft=block.indent*24+'px';appendRuns(element,block.runs);if(!element.childNodes.length)element.appendChild(document.createElement('br'));
 }
}
export function renderNoteRuns(root:HTMLElement,runs:NoteTextRun[]){root.replaceChildren();appendRuns(root,runs);}
