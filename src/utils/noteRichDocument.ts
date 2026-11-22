import type {NoteBlock,NoteTextRun} from '../types';
export const NOTE_FONTS=['맑은 고딕','Arial','Georgia','Courier New'] as const;
export const NOTE_SIZES=[8,10,11,12,14,16,18,20,24,28,32,36,48,72];
export const NOTE_LINE_HEIGHTS=[1,1.2,1.5,1.8,2,2.5];
const marks=['bold','italic','underline','strike'];
const runKeys=['text',...marks,'fontFamily','fontSize','color','highlight','script'];
const alignment=(value:unknown)=>value===undefined||['left','center','right','justify'].includes(value as string);
const only=(value:object,keys:string[])=>Object.keys(value).every(key=>keys.includes(key));
export function validNoteRuns(value:unknown):value is NoteTextRun[]{
 return Array.isArray(value)&&value.length<=4000&&value.every(run=>run&&typeof run==='object'&&typeof run.text==='string'&&only(run,runKeys)&&marks.every(mark=>run[mark]===undefined||typeof run[mark]==='boolean')&&(run.fontFamily===undefined||NOTE_FONTS.includes(run.fontFamily))&&(run.fontSize===undefined||Number.isFinite(run.fontSize)&&run.fontSize>=8&&run.fontSize<=72)&&['color','highlight'].every(key=>run[key]===undefined||typeof run[key]==='string'&&/^#[0-9a-f]{6}$/i.test(run[key]))&&(run.script===undefined||['super','sub'].includes(run.script)));
}
export function validNoteBlocks(value:unknown):value is NoteBlock[]{
 return Array.isArray(value)&&value.length<=1000&&value.every(block=>{
  if(!block||typeof block!=='object')return false;
  if(block.type==='paragraph')return only(block,['type','runs','align','list','indent','lineHeight'])&&validNoteRuns(block.runs)&&alignment(block.align)&&(block.list===undefined||['bullet','number'].includes(block.list))&&(block.indent===undefined||Number.isInteger(block.indent)&&block.indent>=0&&block.indent<=4)&&(block.lineHeight===undefined||NOTE_LINE_HEIGHTS.includes(block.lineHeight));
  return block.type==='table'&&only(block,['type','rows'])&&Array.isArray(block.rows)&&block.rows.length>0&&block.rows.length<=20&&block.rows.every((row:unknown)=>Array.isArray(row)&&row.length>0&&row.length<=20&&row.length===block.rows[0].length&&row.every(cell=>cell&&typeof cell==='object'&&only(cell,['runs','align'])&&validNoteRuns(cell.runs)&&alignment(cell.align)));
 });
}
export function flattenNoteBlocks(blocks:NoteBlock[]):NoteTextRun[]{
 const result:NoteTextRun[]=[];
 const append=(run:NoteTextRun)=>{
  if(!run.text)return;const last=result.at(-1);
  const keys=runKeys.filter(key=>key!=='text') as (keyof NoteTextRun)[];
  if(last&&keys.every(key=>last[key]===run[key]))last.text+=run.text;else result.push({...run});
 };
 blocks.forEach((block,i)=>{
  if(i)append({text:'\n'});
  if(block.type==='paragraph')block.runs.forEach(append);
  else block.rows.forEach((row,r)=>{if(r)append({text:'\n'});row.forEach((cell,c)=>{if(c)append({text:'\t'});cell.runs.forEach(append);});});
 });
 return result;
}
