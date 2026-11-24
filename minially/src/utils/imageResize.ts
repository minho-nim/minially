import {NOTE_PHOTO_MAX_BYTES} from './notePhotos';
// 메모 사진 줄이기: 긴 변 1280px(안 되면 더 작게) JPEG, 240KB 이하. 위치 정보 같은 메타데이터도 빠진다.
export async function resizeNotePhoto(file:Blob):Promise<{dataUrl:string;width:number;height:number}>{
 let bitmap:ImageBitmap;
 try{bitmap=await createImageBitmap(file);}catch{throw new Error('이 사진 형식은 열 수 없습니다(HEIC는 JPG로 바꿔 넣어 주세요).');}
 for(const side of [1280,1024,800,640]){
  const scale=Math.min(1,side/Math.max(bitmap.width,bitmap.height)),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(bitmap,0,0,width,height);
  for(const quality of [0.82,0.7,0.58]){const dataUrl=canvas.toDataURL('image/jpeg',quality);if(dataUrl.length<=NOTE_PHOTO_MAX_BYTES){bitmap.close();return{dataUrl,width,height};}}
 }
 bitmap.close();throw new Error('사진을 충분히 줄이지 못했습니다. 다른 사진으로 시도해 주세요.');
}
