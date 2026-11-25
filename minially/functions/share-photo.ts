// 서비스 워커가 아직 없을 때(설치 직후 등) 공유 POST가 서버로 오면 사진은 받지 않고 앱만 연다.
export const onRequestPost = async () => new Response(null, { status: 303, headers: { location: '/?share-photo=missing' } });
