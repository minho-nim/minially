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
    if (!/^\/v1beta\/models\/[^/]+:generateContent$/.test(req.url ?? '')) return send(404, { error: { message: 'not found' } });
    if (!req.headers['x-goog-api-key']) return send(400, { error: { message: 'API key not valid.' } });
    const prompt = JSON.parse(raw || '{}').contents?.[0]?.parts?.[0]?.text ?? '';
    if (prompt.includes('RATE-LIMIT')) return send(429, { error: { message: 'Resource has been exhausted (e.g. check quota). per minute' } });
    if (prompt.includes('QUOTA-OVER')) return send(429, { error: { message: 'You exceeded your current quota. limit: 0 per day' } });
    const draft = { title: '가짜 Gemini가 쓴 제목', body: '첫 문단입니다.\n[사진]\n두 번째 문단입니다. [작성자 확인 필요]', hashtags: ['#시험', '미니로그', '시험'] };
    send(200, {
      candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 45, totalTokenCount: 165 },
    });
  });
}).listen(port, '127.0.0.1');
