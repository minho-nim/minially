import {noteTopicScore} from './noteSuggestions';
import {flattenNoteBlocks,validNoteBlocks,validNoteRuns} from './noteRichDocument';
import type {Note, NoteFolder} from '../types';

export const LEGACY_NOTE_FOLDERS: NoteFolder[] = [
  { id: 'notes-work', name: '업무', keywords: ['회의', '업무', '출근', '보고서', '프로젝트'] },
  { id: 'notes-daily', name: '일상', keywords: ['일기', '감상', '영화', '기분', '일상'] },
  { id: 'notes-ideas', name: '아이디어', keywords: ['아이디어', '개선', '기능', '개발', '미니어리'] },
  { id: 'notes-travel', name: '여행', keywords: ['여행', '숙소', '항공', '준비물', '여권'] },
];

// 기존 참조와 동기화 데이터를 보존하고, 사용·편집하지 않은 자동 폴더만 목록에서 제외한다.
export function visibleNoteFolders(folders:NoteFolder[],notes:Note[]):NoteFolder[]{
 const used=new Set(notes.map(note=>note.folderId));
 return folders.filter(folder=>folder.isUserManaged||folder.defaultCategoryId||used.has(folder.id)||!LEGACY_NOTE_FOLDERS.some(seed=>seed.id===folder.id&&seed.name===folder.name&&seed.keywords.length===folder.keywords.length&&seed.keywords.every((word,index)=>word===folder.keywords[index])));
}

/** 외부 전송 없이 명시한 키워드와 이미 분류한 메모의 공통 어휘로 추천한다. 자동 이동하지 않는다. */
export function recommendNoteFolders(text: string, folders: NoteFolder[], notes:Note[]=[]): NoteFolder[] {
 const content=text.toLocaleLowerCase();
 const words=(value:string)=>new Set((value.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[]).filter(word=>!['그리고','그래서','합니다','있습니다','오늘','내일'].includes(word)));
 const input=words(text);
 const documents=notes.filter(note=>!note.deletedAt&&note.folderId&&!note.conflictOf).map(note=>({folderId:note.folderId,words:words(note.title+' '+note.body)}));
 return folders.map(folder=>{
  const explicit=[folder.name,...folder.keywords].filter(word=>word.trim()&&content.includes(word.trim().toLocaleLowerCase())).length;
  const matches=new Set<string>();
  for(const document of documents.filter(note=>note.folderId===folder.id))for(const word of document.words)if(input.has(word)&&!documents.some(other=>other.folderId!==folder.id&&other.words.has(word)))matches.add(word);
  // 한 문서의 흔한 단어 하나만으로 분류하지 않는다. 서로 다른 어휘가 둘 이상 겹칠 때만 제안한다.
  return{folder,score:explicit*10+(matches.size>=2?Math.min(9,matches.size):0)+noteTopicScore(text,folder.name)};
 }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.folder.name.localeCompare(b.folder.name)).slice(0,3).map(item=>item.folder);
}
export function noteTitle(note: Pick<Note,'title'|'body'>): string { return note.title.trim() || note.body.trim().split('\n')[0]?.slice(0,80) || '제목 없는 메모'; }

export function validateNote(note: Note): void {
  if (note?.conflictOf !== undefined && (typeof note.conflictOf !== 'string' || !note.conflictOf || note.conflictOf.length>200)) throw new Error('충돌 사본 정보가 올바르지 않습니다.');
  if (note?.conflictAt !== undefined && !Number.isFinite(note.conflictAt)) throw new Error('충돌 사본 날짜가 올바르지 않습니다.');
  if (!note || typeof note.id !== 'string' || !note.id || typeof note.title !== 'string' || typeof note.body !== 'string' || typeof note.folderId !== 'string' || typeof note.pinned !== 'boolean' || !Array.isArray(note.tags) || note.tags.length > 30 || note.tags.some(tag => typeof tag !== 'string' || tag.length > 80) || !Number.isFinite(note.createdAt) || !Number.isFinite(note.updatedAt) || (note.deletedAt !== undefined && !Number.isFinite(note.deletedAt))) throw new Error('메모 형식이 올바르지 않습니다.');
  if (note.richBody !== undefined) {
    if (!validNoteRuns(note.richBody) || note.richBody.map(run => run.text).join('') !== note.body) throw new Error('메모 서식이 올바르지 않습니다.');
    if (new TextEncoder().encode(JSON.stringify(note.richBody)).length + new TextEncoder().encode(note.body).length > 220 * 1024) throw new Error('서식이 포함된 메모가 너무 깁니다. 메모를 나눠 저장해 주세요.');
  }
  if (note.richDocument !== undefined) {
    if (!validNoteBlocks(note.richDocument) || flattenNoteBlocks(note.richDocument).map(run=>run.text).join('') !== note.body) throw new Error('메모 문서 형식이 올바르지 않습니다.');
    if (new TextEncoder().encode(JSON.stringify([note.body,note.richBody,note.richDocument])).length > 220 * 1024) throw new Error('메모 문서가 너무 큽니다. 메모를 나눠 저장해 주세요.');
  }
  if (note.title.length > 500 || new TextEncoder().encode(note.body).length > 128 * 1024) throw new Error('제목은 500자, 본문은 128KB까지 저장할 수 있습니다.');
}
export function validateNoteFolder(folder: NoteFolder): void {
  if (folder?.isUserManaged !== undefined && typeof folder.isUserManaged !== 'boolean') throw new Error('폴더 설정 형식이 올바르지 않습니다.');
  if (folder?.defaultCategoryId !== undefined && typeof folder.defaultCategoryId !== 'string') throw new Error('기본 카테고리 형식이 올바르지 않습니다.');
  if (!folder || typeof folder.id !== 'string' || !folder.id || typeof folder.name !== 'string' || !folder.name.trim() || folder.name.length > 80 || !Array.isArray(folder.keywords) || folder.keywords.length > 30 || folder.keywords.some(word => typeof word !== 'string' || word.length > 80)) throw new Error('메모 분류 형식이 올바르지 않습니다.');
}
