// 시험용 가짜 Gemini 서버(실제 Google API·크레딧을 쓰지 않음).
// 사용: node mock-gemini.mjs <port>. 받은 글에 "RATE-LIMIT"가 있으면 429, "QUOTA-OVER"면 하루 한도 초과,
// "OVERLOAD-ONCE"면 처음 한 번만 503(다시 부르기 시험), "OVERLOAD-ALWAYS"면 계속 503, "BAD-REQUEST"면 400을 흉내 낸다.
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 8899);
const overloadedOnce = new Set(); // 'OVERLOAD-ONCE' 글은 처음 한 번만 503
createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.url === '/health') return send(200, { ok: true });
    // 티스토리 RSS 흉내: /rss/tistory/{이름}/rss (태그는 <category>로)
    const tistory = (req.url ?? '').match(/^\/rss\/tistory\/([^/]+)\/rss$/);
    if (tistory) {
      const name = tistory[1];
      res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8' });
      return res.end(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${name}</title><item><title>제주 여행 3박 4일 코스</title><link>https://${name}.tistory.com/42</link><description>&lt;p&gt;제주 여행 정리&lt;/p&gt;</description><category>여행</category><category>제주</category><pubDate>Sun, 22 Nov 2026 07:00:00 +0900</pubDate></item></channel></rss>`);
    }
    // 네이버 블로그 RSS 흉내: /rss/{아이디}.xml (아이디 'nobody'는 없는 블로그)
    const rss = (req.url ?? '').match(/^\/rss\/([^/]+)\.xml$/);
    if (rss) {
      if (rss[1] === 'nobody') { res.writeHead(404); return res.end('not found'); }
      const id = rss[1];
      const pre = id === 'myblog' ? '223' : id === 'lastyear' ? '225' : '224'; // 네이버 글 번호는 블로그끼리 겹치지 않는다
      const item = (no, title, date, tags) => `<item><title><![CDATA[${title}]]></title><link>https://blog.naver.com/${id}/${no}?fromRss=true&amp;trackingCode=rss</link><guid>https://blog.naver.com/${id}/${no}</guid><description><![CDATA[<p>${title} 본문 앞부분이에요 &amp; 사진도 있어요.</p>]]></description><pubDate>${date}</pubDate><tag><![CDATA[${tags}]]></tag></item>`;
      res.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8' });
      // 수요 예측 시험용: 오늘 기준 작년 이맘때(352·345일 전, 한국 정오) 글
      const daysAgo = days => { const d = new Date(Date.now() - days * 86400000); d.setUTCHours(3, 0, 0, 0); return d.toUTCString(); };
      if (id === 'lastyear') return res.end(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${id}</title>` +
        item(`${pre}000000001`, '작년 겨울 붕어빵 지도', daysAgo(352), '붕어빵,겨울간식') + item(`${pre}000000002`, '작년 귤 따기 체험', daysAgo(345), '귤') + '</channel></rss>');
      return res.end(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${id}</title>` +
        (id === 'myblog'
          ? item(`${pre}000000001`, '동네 빵집 소금빵 후기', 'Mon, 02 Nov 2026 10:00:00 +0900', '빵집,소금빵') +
            item(`${pre}000000002`, '겨울 카페 투어 3곳', 'Sat, 14 Nov 2026 18:30:00 +0900', '카페') +
            item(`${pre}000000003`, '앰플 한 달 사용기', 'Fri, 20 Nov 2026 09:00:00 +0900', '')
          : item(`${pre}000000001`, `${id}의 첫 글`, 'Sun, 22 Nov 2026 08:00:00 +0900', '')) + '</channel></rss>');
    }
    if (!/^\/v1beta\/models\/[^/]+:generateContent$/.test(req.url ?? '')) return send(404, { error: { message: 'not found' } });
    if (!req.headers['x-goog-api-key']) return send(400, { error: { message: 'API key not valid.' } });
    const parts = JSON.parse(raw || '{}').contents?.[0]?.parts ?? [];
    const prompt = parts.map(p => p.text ?? '').join('');
    const images = parts.filter(p => p.inline_data?.data).length;
    if (prompt.includes('OVERLOAD-ALWAYS')) return send(503, { error: { code: 503, message: 'The model is overloaded. Please try again later.', status: 'UNAVAILABLE' } });
    if (prompt.includes('OVERLOAD-ONCE') && !overloadedOnce.has(prompt)) { overloadedOnce.add(prompt); return send(503, { error: { code: 503, message: 'The model is overloaded.', status: 'UNAVAILABLE' } }); }
    // 구글이 2.5 모델을 새 키에 열어 주지 않는 경우(404): 대체 모델(3.x)로는 답한다
    if (prompt.includes('OLD-MODEL-GONE') && /gemini-2\.5/.test(req.url ?? '')) return send(404, { error: { code: 404, message: 'models/gemini-2.5-flash-lite is no longer available to new users.', status: 'NOT_FOUND' } });
    if (prompt.includes('BAD-REQUEST')) return send(400, { error: { code: 400, message: 'Request contains an invalid argument.', status: 'INVALID_ARGUMENT' } });
    if (prompt.includes('RATE-LIMIT')) return send(429, { error: { message: 'Resource has been exhausted (e.g. check quota). per minute' } });
    if (prompt.includes('QUOTA-OVER')) return send(429, { error: { message: 'You exceeded your current quota. limit: 0 per day' } });
    const ok = text => send(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(text) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 45, totalTokenCount: 165 } });
    if (prompt.includes('블로거의 메일함을 정리하는')) {
      // 제목 낱말로 종류를 정한다: 협찬 제안 → offer, 선정 → notice, 답장 → pitch_reply, 그 밖 → other
      const mails = [...prompt.matchAll(/<메일 id="([^"]+)">\n보낸 사람: .*\n제목: (.*)\n/g)].map(m => {
        const [id, subject] = [m[1], m[2]];
        if (subject.includes('협찬 제안')) return { id, kind: 'offer', brand: '메일빵집', title: '겨울 신메뉴 체험', amount: 50000, deadline: '2026-12-20', visit_on: null, answer: 'unknown', summary: '메일빵집이 신메뉴 체험을 제안', needs_reply: true };
        if (subject.includes('선정')) return { id, kind: 'notice', brand: '메일구름카페', title: '체험단 선정', amount: 0, deadline: null, visit_on: '2026-12-05', answer: 'unknown', summary: '체험단 선정 안내', needs_reply: false };
        if (subject.includes('답장')) return { id, kind: 'pitch_reply', brand: '메일달빛상점', title: '', amount: 0, deadline: null, visit_on: null, answer: 'yes', summary: '내 제안에 좋다고 답함', needs_reply: true };
        return { id, kind: 'other', brand: '', title: '', amount: 0, deadline: null, visit_on: null, answer: 'unknown', summary: '기타', needs_reply: false };
      });
      return ok({ mails });
    }
    if (prompt.includes('블로거 대신 메일 답장 초안을')) {
      const sign = prompt.match(/끝에 서명: (.*)/)?.[1] ?? '';
      const replies = [...prompt.matchAll(/<메일 id="([^"]+)" 종류="[^"]+">\n보낸 사람: .*\n제목: (.*)\n/g)].map(m => ({ id: m[1], subject: `Re: ${m[2]}`, body: `안녕하세요, 가짜 AI 답장 초안이에요.\n방문 일정은 [확인 필요]\n${sign}` }));
      return ok({ replies });
    }
    if (prompt.includes('블로그 체험단 가이드를 정리하는')) {
      const brand = images ? '캡처카페' : (prompt.match(/업체명:\s*(\S+)/)?.[1] ?? '가이드카페');
      return ok({ brand, title: `${brand} 겨울 신메뉴 체험단`, provided: '2인 식사권(5만 원 상당)', amount: 30000, deadline: '2026-12-10', apply_by: '2026-11-28', visit_on: '2026-12-01', keywords: ['성수 카페', '소금빵', '성수 카페'], hashtags: ['#성수카페', '체험단'], min_photos: 15, min_chars: 1500, links: ['https://map.naver.com/p/entry/place/1', 'http://not-https.example'], notes: '공정위 문구 필수' });
    }
    if (prompt.includes('협찬 제안서(미디어킷) 문구')) {
      // 자료에 있는 숫자·업체만 쓰는지 시험에서 확인할 수 있게 자료 일부를 그대로 돌려준다
      const avg = prompt.match(/평균 조회수 (\S+?)\(/)?.[1] ?? '?';
      return ok({ blog_name: '토몽이의 동네 기록', topic: '동네 카페·빵집', intro: '직접 가 보고 솔직하게 쓰는 동네 기록', about: `평균 조회수 ${avg} 기준으로 소개해요.`, audience: '주말 나들이를 찾는 20~30대로 보여요.', strengths: '- 사진이 많아요\n- 솔직한 후기\n- 꾸준한 업로드', offers: '- 체험단(방문 후기)\n- 제품 리뷰', cases: prompt.includes('보고시험카페') ? '- 보고시험카페 체험단' : '' });
    }
    if (prompt.includes('인스타그램 게시물 글로 바꾸는')) {
      return ok({ caption: `오늘의 기록 한 줄 [사진 1]\n\n가짜 AI 인스타 글이에요.${prompt.includes('[자연스러운 한국어 규칙]') ? ' (규칙 적용)' : ''}`, hashtags: ['#카페', '시험 태그', '카페'] });
    }
    if (prompt.includes('협찬 제안 인스타그램 DM을 다듬는')) {
      return ok({ subject: '', body: `안녕하세요! 다듬은 DM이에요.${prompt.includes('[자연스러운 한국어 규칙]') ? ' (규칙 적용)' : ''}` });
    }
    if (prompt.includes('협찬 제안 메일을 다듬는')) {
      const brand = prompt.match(/\[업체\] (.+)/)?.[1] ?? '';
      return ok({ subject: `[협찬 제안] ${brand}님께 (다듬음)`, body: `안녕하세요, ${brand} 담당자님. 다듬은 본문이에요. 블로그 소개서(PDF)를 첨부했어요.` });
    }
    if (prompt.includes('블로그 글감을 추천')) {
      // 검색 모드(tools)면 JSON 앞뒤에 설명 글이 섞여 오는 것까지 흉내 낸다
      const search = Array.isArray(JSON.parse(raw || '{}').tools);
      const ideas = [
        /\[다가오는 시기\]\n- \d\d-\d\d~/.test(prompt) ? { topic: '시기에 맞춘 카페 글', title: '시기 맞춤: 창가 자리 카페 3곳', reason: '다가오는 시기', hashtags: ['#카페', '데이트'], source: 'trend' } : { topic: '시기 없음', title: '시기 없이 쓴 글감', reason: '시기 없음', hashtags: [], source: 'mine' },
        { topic: '겨울 여행 코스', title: prompt.includes('제주 여행 3박 4일 코스') ? '참고 블로그 반영: 겨울 제주 코스' : '겨울 국내 여행 코스', reason: '참고 블로그 흐름', hashtags: ['여행'], source: 'blogs' },
        ...((q => (q ? [{ topic: `잠잠한 카테고리: ${q[1]}`, title: `${q[1]} 새 글`, reason: '오래 글이 없는 카테고리', hashtags: [], source: 'mine' }] : []))(prompt.match(/\[오래 글이 없는 내 블로그 카테고리[^\]]*\]\n- ([^\n]+)/))),
        ...(search ? [{ topic: '검색으로 찾은 글감', title: '요즘 뜨는 연말 팝업 후기', reason: '구글 검색', hashtags: ['팝업'], source: 'search' }] : []),
      ];
      const text = JSON.stringify({ ideas });
      return send(200, { candidates: [{ content: { parts: [{ text: search ? `검색해 보니 이래요.\n\`\`\`json\n${text}\n\`\`\`` : text }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 80, totalTokenCount: 380 } });
    }
    if (prompt.includes('통계 화면')) {
      return ok({ posts: [{ title: '동네 빵집 소금빵 후기', views: 1520, likes: 48, comments: 12 }, { title: '겨울 카페 투어', views: 830, likes: 21, comments: null }, { title: '없는 글 제목', views: 5, likes: 0, comments: 0 }] });
    }
    if (prompt.includes('스레드와 X(트위터)에 올릴 짧은 글')) {
      // 다른 곳에도 올리기: 서버가 해시태그·주소·[사진] 표시를 지워야 한다
      return ok({ threads: '빵 좋아하면 꼭 가 보세요 #빵스타그램\n소금빵이 바삭해요 [사진 1]', x: '동네 빵집 소금빵 바삭 https://spam.example' });
    }
    if (prompt.includes('블로그 초안을 쓰기 전에 작성자에게 물어볼 질문')) {
      // 초안 전 질문: 경험 글이 <경험> 안에 들어갔는지 첫 질문의 이유 칸에 앞부분을 돌려준다
      const exp = prompt.match(/<경험>\n([\s\S]*?)\n<\/경험>/)?.[1] ?? '';
      return ok({ questions: [{ q: '소금빵 가격은 얼마였나요?', why: `경험: ${exp.slice(0, 12)}` }, { q: '아쉬웠던 점이 있었나요?', why: '솔직한 단점' }, { q: '', why: '빈 질문은 서버가 뺌' }] });
    }
    if (prompt.includes('글(예약 문자·메일·공지) 속 일정을 찾는 도우미')) {
      // 글로 넣기 'AI로 다시 읽기': 붙여넣은 글이 <글> 안에 들어갔는지 근거 칸에 그대로 돌려준다
      const body = prompt.match(/<글>\n([\s\S]*?)\n<\/글>/)?.[1] ?? '';
      return ok({ events: [{ title: '돌잔치', date: '2026-12-20', start: '12:00', end: null, location: '', memo: '', source: body.slice(0, 40), uncertain: false }] });
    }
    if (prompt.includes('사진 속 일정을 찾는 도우미')) {
      // 사진으로 일정 넣기: 오늘 날짜가 프롬프트에 들어갔는지 제목에 적고, 형식이 틀린 후보(날짜 없음·13월)는 서버가 걸러야 한다
      const today = prompt.match(/오늘은 (\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
      return ok({ events: [
        { title: '치과 진료', date: '2026-12-02', start: '15:00', end: '16:00', location: '', memo: '', source: '12월 2일(수) 오후 3시 진료 예약', uncertain: false },
        { title: `송년회(오늘 ${today})`, date: '2026-12-18', start: '19:00', end: '18:00', location: '강남역 3번 출구', memo: '', source: '12/18(금) 저녁 7시', uncertain: true },
        { title: '날짜 없는 일정', date: '', start: null, end: null },
        { title: '틀린 날짜', date: '2026-13-01', start: '25:00' },
      ] });
    }
    if (prompt.includes('문체 요약을 다듬는')) {
      // '더 내 스타일로': 보낸 원고 쌍 수를 요약에 적어 시험에서 확인한다
      const pairs = (prompt.match(/<고친 글>\n/g) ?? []).length; // 안내 문장 속 '<고친 글>은'은 빼고 자료 칸만 센다
      return ok({ summary: `더 짧고 담백하게 다듬은 문체예요(고친 원고 ${pairs}개 반영).`, tone: '담백한 존댓말', sentence: '더 짧은 문장', structure: '방문 계기 → 메뉴 → 총평', expressions: ['진짜'], emoji: '거의 안 씀', hashtags: '지역+가게 이름', avoid: ['정말 강력 추천'], changes: ['감탄 표현을 줄였어요', '이모티콘을 거의 지웠어요'] });
    }
    if (prompt.includes('문체를 분석') && prompt.includes('다른 블로거의 글이다')) {
      return ok({ summary: '참고 블로거는 정보를 표로 정리하고 담백하게 써요.', tone: '담백한 존댓말', sentence: '중간 길이', structure: '요약 → 상세 → 팁', expressions: ['남의표현'], emoji: '거의 안 씀', hashtags: '5개 안팎' });
    }
    if (prompt.includes('문체를 분석')) {
      return ok({ summary: '친근한 존댓말로 짧게 끊어 쓰는 문체예요. 감탄과 솔직한 후기가 많아요.', tone: '친근한 존댓말', sentence: '짧은 문장 위주', structure: '방문 계기 → 메뉴 → 총평', expressions: ['진짜', '완전 추천'], emoji: 'ㅎㅎ를 가끔 씀', hashtags: '지역+가게 이름' });
    }
    const postType = prompt.match(/\[글 종류: ([^\]]+)\]/)?.[1]; // 글 종류 안내가 들어갔는지 시험에서 볼 수 있게
    const photoLines = images ? Array.from({ length: images }, (_, i) => `[사진 ${i + 1}]`).join('\n') : '[사진]';
    const avoided = prompt.includes('피하는 표현(') ? ' · 피하는 표현' : ''; // '더 내 스타일로'로 생긴 피하는 표현이 초안 프롬프트에 들어갔는지
    const styled = !prompt.includes('<문체>') ? '' : prompt.includes('다른 블로거의 쓰는 방식') ? (prompt.includes('남의표현') ? ' · 표현 샘' : ' · 참고 문체') : ' · 내 문체';
    const memo = prompt.match(/<사진 메모>\n([\s\S]*?)\n<\/사진 메모>/)?.[1]; // 사진 메모가 자료로 들어갔는지 시험에서 볼 수 있게
    const draft = { title: (images ? `가짜 Gemini가 쓴 제목(사진 ${images}장)` : '가짜 Gemini가 쓴 제목') + styled + avoided, body: `첫 문단입니다.\n${photoLines}\n두 번째 문단입니다. [작성자 확인 필요]${postType ? `\n(글 종류: ${postType})` : ''}${prompt.includes('[글 구조: 홈피드형]') ? '\n(글 구조: 홈피드형)' : ''}${memo ? `\n(메모 반영: ${memo.split('\n')[0]})\n가격은 9,900원이었어요.` : ''}`, hashtags: ['#시험', '미니로그', '시험'] };
    send(200, {
      candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 45, totalTokenCount: 165 },
    });
  });
}).listen(port, '127.0.0.1');
