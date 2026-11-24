// 사진 줄이기(원고 사진·가이드 캡처 공용)
/** 올리기 전에 브라우저에서 긴 변을 1600px로 줄이고 JPG로 바꾼다(저장 공간·AI 토큰 절약, 위치 정보 등 메타데이터도 빠짐). */
export async function shrinkPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error(`${file.name}: 이 사진 형식은 열 수 없어요(HEIC는 JPG로 바꿔 올려 주세요).`); }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('사진을 처리하지 못했어요.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('사진을 처리하지 못했어요.');
  return blob;
}
