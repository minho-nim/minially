import type {CategoryItem,Note,Task,Schedule,ChangeHistoryEntry,TaskPriority} from '../types';
export interface NoteRegistrationInput {kind:'task'|'schedule';title:string;date:string;categoryId:string;sourceText:string;startTime?:string;endTime?:string;priority:TaskPriority}
export interface NoteRegistrationResult {tasks:number;schedules:number;skipped:number;history?:ChangeHistoryEntry}
export function existingNoteRegistration(entry:NoteRegistrationInput,noteId:string,tasks:Task[],schedules:Schedule[]){return entry.kind==='task'?tasks.some(item=>item.sourceNoteId===noteId&&item.dueDate===entry.date&&typeof (item.sourceNoteExcerpt??item.memo??'')==='string'&&(item.sourceNoteExcerpt??item.memo??'').trim()===entry.sourceText.trim()):schedules.some(item=>item.sourceNoteId===noteId&&item.date===entry.date&&typeof (item.sourceNoteExcerpt??item.memo??'')==='string'&&(item.sourceNoteExcerpt??item.memo??'').trim()===entry.sourceText.trim());}
export interface NoteRegistrationSuggestion extends NoteRegistrationInput {key:string;reasons:string[]}
const vocab=[
 {names:['업무','회사','직장','work'],words:['회의','보고서','프로젝트','고객','제안서','팀 회의','팀회의','출근','견적','계약']},
 {names:['공부','학습','자기계발','study'],words:['공부','수업','강의','시험','과제','복습','영어','학원','독서']},
 {names:['건강','병원','운동','health'],words:['병원','진료','검진','운동','헬스','치과','복용','약먹기','걷기','수영']},
 {names:['여행','휴가','travel'],words:['여행','숙소','항공','여권','비행기','호텔','공항','준비물']},
 {names:['아이디어','기획','idea'],words:['아이디어','개선','기능','개발','구상','기획']},
 {names:['개인','일상','생활','daily'],words:['장보기','마트','청소','빨래','우유','계란','택배','가족']},
 {names:['약속','모임','데이트'],words:['약속','모임','데이트','친구','점심','저녁','식사']},
 {names:['결제','금융','가계','돈'],words:['결제','납부','이체','카드','은행','보험','월세','청구']},
];
export function noteTopicScore(text:string,name:string){const value=text.toLocaleLowerCase(),label=name.toLocaleLowerCase();return vocab.filter(group=>group.names.some(word=>label.includes(word))).reduce((score,group)=>score+group.words.filter(word=>value.includes(word)).length,0);}
const ymd=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function validRegistrationDate(value:string){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d);return y>=1900&&y<=9999&&date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d;}
const validTime=(value:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function validateNoteRegistration(entry:NoteRegistrationInput){
 if(!entry||!['task','schedule'].includes(entry.kind)||typeof entry.title!=='string'||!entry.title.trim()||entry.title.length>500||!validRegistrationDate(entry.date)||typeof entry.categoryId!=='string'||typeof entry.sourceText!=='string'||!entry.sourceText.trim()||new TextEncoder().encode(entry.sourceText).length>100*1024||!['low','medium','high'].includes(entry.priority))throw new Error('등록할 제목·날짜·내용을 확인해 주세요.');
 if(entry.kind==='schedule'&&((entry.startTime!==undefined&&!validTime(entry.startTime))||(entry.endTime!==undefined&&(!validTime(entry.endTime)||!entry.startTime||entry.endTime<=entry.startTime))))throw new Error('일정의 카테고리와 시작·종료 시간을 확인해 주세요.');
}
function suggestCategory(text:string,categories:CategoryItem[],preferred:string){
 const ranked=categories.map(category=>({id:category.id,score:(category.name.length>=2&&text.includes(category.name)?20:0)+noteTopicScore(text,category.name)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score);
 return ranked.length&&(!ranked[1]||ranked[0].score>ranked[1].score)?ranked[0].id:categories.some(category=>category.id===preferred)?preferred:categories.length===1?categories[0].id:'';
}
export function suggestNoteRegistrations(note:Pick<Note,'title'|'body'>,categories:CategoryItem[],preferredCategory='',base=new Date()):NoteRegistrationSuggestion[]{
 const lines=(note.body.trim()||note.title.trim()).replace(/([다요])\.\s+/g,'$1.\n').split(/\r?\n|[;；]|\s+그리고\s+/).map(value=>value.trim()).filter(value=>value&&!/^\s*(?:[-*•]\s*)?\[[xX✓]\]/.test(value)&&!/^#{1,6}\s/.test(value)&&!value.endsWith(':')).map(value=>value.replace(/^(?:[-*•]\s*|\d+[.)]\s+|\[ \]\s*)/,'').replace(/^\[ \]\s*/,'').trim()).filter(Boolean);
 return [...new Set(lines)].slice(0,30).map((text,index)=>{
  const reasons:string[]=[],today=new Date(base.getFullYear(),base.getMonth(),base.getDate());let date=ymd(today),title=text;
  const explicit=[...text.matchAll(/(?:(\d{4})[년.\-/]\s*)?(\d{1,2})\s*(?:월\s*|[.\-/])(\d{1,2})(?:일)?(?!\d)/g)].find(match=>!match.index||!/[\w.]/.test(text[match.index-1]));
  const relative=text.match(/(오늘|내일|모레)(?=$|[^가-힣]|오전|오후|아침|저녁|밤)/),weekday=text.match(/(?:(다음\s*주|이번\s*주)\s*)?([월화수목금토일])요일/);
  if(explicit){date=`${explicit[1]||today.getFullYear()}-${explicit[2].padStart(2,'0')}-${explicit[3].padStart(2,'0')}`;reasons.push(validRegistrationDate(date)?explicit[0]:'날짜 확인 필요');if(!validRegistrationDate(date))date='';title=title.replace(explicit[0],'');}
  else if(relative){today.setDate(today.getDate()+({오늘:0,내일:1,모레:2}[relative[1]]??0));date=ymd(today);reasons.push(relative[1]);title=title.replace(relative[0],'');}
  else if(weekday){const day='일월화수목금토'.indexOf(weekday[2]),current=today.getDay();let delta=(day-current+7)%7;if(weekday[1]?.replace(/\s/g,'')==='다음주')delta=(7-(current+6)%7)+(day+6)%7;else if(weekday[1])delta=(day+6)%7-(current+6)%7;today.setDate(today.getDate()+delta);date=ymd(today);reasons.push(weekday[0]);title=title.replace(weekday[0],'');}
  const timeMatches=[...text.matchAll(/(오전|오후|아침|저녁|밤)?\s*(\d{1,2})(?::(\d{2})|시(?!간)(?:\s*(\d{1,2})분|\s*(반))?)/g)].slice(0,2);
  const time=(match:RegExpMatchArray,period?:string)=>{let hour=Number(match[2]);const half=match[1]||period;if(half&&hour>=1&&hour<=12){hour%=12;if(['오후','저녁','밤'].includes(half))hour+=12;}return `${String(hour).padStart(2,'0')}:${String(Number(match[3]??match[4]??(match[5]?30:0))).padStart(2,'0')}`;};
  const startTime=timeMatches[0]?time(timeMatches[0]):undefined,endTime=timeMatches[1]?time(timeMatches[1],timeMatches[0]?.[1]):undefined;
  if(startTime)reasons.push(validTime(startTime)?startTime:'시간 확인 필요');for(const match of timeMatches)title=title.replace(match[0],' ');
  const action=/(제출|정리|준비|구매|보내기|확인|작성|납부|해야|할 것|하기)/.test(text),event=/(회의|약속|진료|검진|수업|모임|미팅|면접|예약)/.test(text);
  const kind=(startTime||event)&&!(action&&/까지/.test(text))?'schedule':'task';title=title.replace(/^\s*(?:에|부터|까지|[~～])\s*/,'').replace(/\s*[~～]\s*/g,' ').replace(/\s+/g,' ').trim();
  const categoryId=suggestCategory(text,categories,preferredCategory);if(categoryId)reasons.push(categories.find(category=>category.id===categoryId)!.name);
  return {key:String(index),kind,title:(title||text).slice(0,500),date,categoryId,sourceText:text,startTime,endTime,priority:/(긴급|중요|반드시|마감|!!)/.test(text)?'high':'medium',reasons};
 });
}
