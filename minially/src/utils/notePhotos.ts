import type {NotePhoto} from '../types';
// 메모 사진 검사(이 기기·서버 동기화 모두): 줄인 이미지 data URL, 240KB 이하
export const NOTE_PHOTO_MAX_BYTES=240*1024;
export function validateNotePhoto(photo:NotePhoto):void{
 if(!photo||typeof photo.id!=='string'||!/^[0-9a-f-]{36}$/.test(photo.id)||typeof photo.noteId!=='string'||!photo.noteId||photo.noteId.length>200)throw new Error('메모 사진 정보가 올바르지 않습니다.');
 if(typeof photo.dataUrl!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(photo.dataUrl))throw new Error('메모 사진 형식이 올바르지 않습니다.');
 if(photo.dataUrl.length>NOTE_PHOTO_MAX_BYTES)throw new Error('메모 사진이 너무 큽니다.');
 if(![photo.width,photo.height].every(n=>Number.isInteger(n)&&n>0&&n<=4096)||!Number.isFinite(photo.createdAt)||!Number.isFinite(photo.updatedAt))throw new Error('메모 사진 정보가 올바르지 않습니다.');
}
