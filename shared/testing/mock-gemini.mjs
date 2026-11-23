// 시험용 가짜 Gemini 서버(실제 Google API·크레딧을 쓰지 않음).
// 사용: node mock-gemini.mjs <port>. 받은 글에 "RATE-LIMIT"가 있으면 429, "QUOTA-OVER"면 하루 한도 초과를 흉내 낸다.
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 8899);
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
      const pre = id === 'myblog' ? '223' : '224'; // 네이버 글 번호는 블로그끼리 겹치지 않는다
      const item = (no, title, date, tags) => `<item><title><![CDATA[${title}]]></title><link>https://blog.naver.com/${id}/${no}?fromRss=true&amp;trackingCode=rss</link><guid>https://blog.naver.com/${id}/${no}</guid><description><![CDATA[<p>${title} 본문 앞부분이에요 &amp; 사진도 있어요.</p>]]></description><pubDate>${date}</pubDate><tag><![CDATA[${tags}]]></tag></item>`;
      res.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8' });
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
    if (prompt.includes('RATE-LIMIT')) return send(429, { error: { message: 'Resource has been exhausted (e.g. check quota). per minute' } });
    if (prompt.includes('QUOTA-OVER')) return send(429, { error: { message: 'You exceeded your current quota. limit: 0 per day' } });
    const ok = text => send(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(text) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 45, totalTokenCount: 165 } });
    if (prompt.includes('블로그 글감을 추천')) {
      // 검색 모드(tools)면 JSON 앞뒤에 설명 글이 섞여 오는 것까지 흉내 낸다
      const search = Array.isArray(JSON.parse(raw || '{}').tools);
      const ideas = [
        /\[다가오는 시기\]\n- \d\d-\d\d~/.test(prompt) ? { topic: '시기에 맞춘 카페 글', title: '시기 맞춤: 창가 자리 카페 3곳', reason: '다가오는 시기', hashtags: ['#카페', '데이트'], source: 'trend' } : { topic: '시기 없음', title: '시기 없이 쓴 글감', reason: '시기 없음', hashtags: [], source: 'mine' },
        { topic: '겨울 여행 코스', title: prompt.includes('제주 여행 3박 4일 코스') ? '참고 블로그 반영: 겨울 제주 코스' : '겨울 국내 여행 코스', reason: '참고 블로그 흐름', hashtags: ['여행'], source: 'blogs' },
        ...(search ? [{ topic: '검색으로 찾은 글감', title: '요즘 뜨는 연말 팝업 후기', reason: '구글 검색', hashtags: ['팝업'], source: 'search' }] : []),
      ];
      const text = JSON.stringify({ ideas });
      return send(200, { candidates: [{ content: { parts: [{ text: search ? `검색해 보니 이래요.\n\`\`\`json\n${text}\n\`\`\`` : text }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 80, totalTokenCount: 380 } });
    }
    if (prompt.includes('통계 화면')) {
      return ok({ posts: [{ title: '동네 빵집 소금빵 후기', views: 1520, likes: 48, comments: 12 }, { title: '겨울 카페 투어', views: 830, likes: 21, comments: null }, { title: '없는 글 제목', views: 5, likes: 0, comments: 0 }] });
    }
    if (prompt.includes('문체를 분석') && prompt.includes('다른 블로거의 글이다')) {
      return ok({ summary: '참고 블로거는 정보를 표로 정리하고 담백하게 써요.', tone: '담백한 존댓말', sentence: '중간 길이', structure: '요약 → 상세 → 팁', expressions: ['남의표현'], emoji: '거의 안 씀', hashtags: '5개 안팎' });
    }
    if (prompt.includes('문체를 분석')) {
      return ok({ summary: '친근한 존댓말로 짧게 끊어 쓰는 문체예요. 감탄과 솔직한 후기가 많아요.', tone: '친근한 존댓말', sentence: '짧은 문장 위주', structure: '방문 계기 → 메뉴 → 총평', expressions: ['진짜', '완전 추천'], emoji: 'ㅎㅎ를 가끔 씀', hashtags: '지역+가게 이름' });
    }
    const photoLines = images ? Array.from({ length: images }, (_, i) => `[사진 ${i + 1}]`).join('\n') : '[사진]';
    const styled = !prompt.includes('<문체>') ? '' : prompt.includes('다른 블로거의 쓰는 방식') ? (prompt.includes('남의표현') ? ' · 표현 샘' : ' · 참고 문체') : ' · 내 문체';
    const draft = { title: (images ? `가짜 Gemini가 쓴 제목(사진 ${images}장)` : '가짜 Gemini가 쓴 제목') + styled, body: `첫 문단입니다.\n${photoLines}\n두 번째 문단입니다. [작성자 확인 필요]`, hashtags: ['#시험', '미니로그', '시험'] };
    send(200, {
      candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 45, totalTokenCount: 165 },
    });
  });
}).listen(port, '127.0.0.1');
