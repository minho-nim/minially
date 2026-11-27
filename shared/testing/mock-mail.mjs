// 시험용 가짜 메일 서버: IMAP(포트)·SMTP(포트+1)·조작용 HTTP(포트+2). 암호화 없이 127.0.0.1에서만.
// 앱 비밀번호는 'app-pass'만 받는다. HTTP: POST /inbox {raw} 메일 넣기, POST /reset, GET /sent 보낸 메일, GET /health
import net from 'node:net';
import http from 'node:http';

const port = Number(process.argv[2] || 8903);
let inbox = []; // { uid, raw }
let sent = []; // { from, to, data }
let nextUid = 101;

net.createServer(sock => {
  sock.on('error', () => {});
  let buf = '';
  sock.write('* OK mock IMAP ready\r\n');
  sock.on('data', d => {
    buf += d.toString('latin1');
    let i;
    while ((i = buf.indexOf('\r\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      const [tag, cmd, ...rest] = line.split(' ');
      const args = rest.join(' ');
      const up = (cmd || '').toUpperCase();
      if (up === 'LOGIN') sock.write(args.endsWith('"app-pass"') ? `${tag} OK LOGIN completed\r\n` : `${tag} NO [AUTHENTICATIONFAILED] Invalid credentials\r\n`);
      else if (up === 'SELECT') sock.write(`* ${inbox.length} EXISTS\r\n* OK [UIDVALIDITY 7] UIDs valid\r\n${tag} OK [READ-WRITE] SELECT completed\r\n`);
      else if (up === 'UID' && /^SEARCH/i.test(args)) {
        const from = Number(args.match(/UID (\d+):\*/)?.[1] ?? 0);
        let uids = inbox.map(m => m.uid).filter(u => u >= from);
        if (!uids.length && inbox.length) uids = [inbox[inbox.length - 1].uid]; // IMAP은 n:*에 마지막 메일을 늘 돌려준다
        sock.write(`* SEARCH ${uids.join(' ')}\r\n${tag} OK SEARCH completed\r\n`);
      } else if (up === 'UID' && /^FETCH/i.test(args)) {
        const uid = Number(args.match(/FETCH (\d+)/)?.[1]);
        const m = inbox.find(x => x.uid === uid);
        if (m) { const raw = Buffer.from(m.raw, 'utf8'); sock.write(`* 1 FETCH (UID ${uid} BODY[]<0> {${raw.length}}\r\n`); sock.write(raw); sock.write(')\r\n'); }
        sock.write(`${tag} OK FETCH completed\r\n`);
      } else if (up === 'LOGOUT') sock.end(`* BYE\r\n${tag} OK LOGOUT completed\r\n`);
      else sock.write(`${tag} BAD unknown\r\n`);
    }
  });
}).listen(port, '127.0.0.1');

net.createServer(sock => {
  sock.on('error', () => {});
  let buf = '', step = 'cmd', mail = { from: '', to: '', data: '' }, user = '';
  sock.write('220 mock SMTP ready\r\n');
  sock.on('data', d => {
    buf += d.toString('latin1');
    for (;;) {
      if (step === 'data') {
        const end = buf.indexOf('\r\n.\r\n');
        if (end < 0) return;
        mail.data = Buffer.from(buf.slice(0, end), 'latin1').toString('utf8'); buf = buf.slice(end + 5);
        sent.push(mail); mail = { from: '', to: '', data: '' }; step = 'cmd';
        sock.write('250 OK queued\r\n'); continue;
      }
      const i = buf.indexOf('\r\n');
      if (i < 0) return;
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (step === 'user') { user = Buffer.from(line, 'base64').toString(); step = 'pass'; sock.write('334 UGFzc3dvcmQ6\r\n'); continue; }
      if (step === 'pass') { step = 'cmd'; sock.write(Buffer.from(line, 'base64').toString() === 'app-pass' && user ? '235 Authentication successful\r\n' : '535 Authentication failed\r\n'); continue; }
      const up = line.toUpperCase();
      if (up.startsWith('EHLO')) sock.write('250-mock\r\n250 AUTH LOGIN\r\n');
      else if (up === 'AUTH LOGIN') { step = 'user'; sock.write('334 VXNlcm5hbWU6\r\n'); }
      else if (up.startsWith('MAIL FROM:')) { mail.from = line.slice(10).replace(/[<>]/g, ''); sock.write('250 OK\r\n'); }
      else if (up.startsWith('RCPT TO:')) { mail.to = line.slice(8).replace(/[<>]/g, ''); sock.write('250 OK\r\n'); }
      else if (up === 'DATA') { step = 'data'; sock.write('354 End data with <CR><LF>.<CR><LF>\r\n'); }
      else if (up === 'QUIT') sock.end('221 Bye\r\n');
      else sock.write('500 unknown\r\n');
    }
  });
}).listen(port + 1, '127.0.0.1');

http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    const send = (code, data) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (req.url === '/health') return send(200, { ok: true });
    if (req.url === '/reset' && req.method === 'POST') { inbox = []; sent = []; return send(200, { ok: true }); }
    if (req.url === '/inbox' && req.method === 'POST') { const b = JSON.parse(body); const uid = Number.isInteger(b.uid) && b.uid >= nextUid ? b.uid : nextUid; nextUid = uid + 1; inbox.push({ uid, raw: b.raw }); return send(200, { uid }); } // uid를 주면 그 번호로(서버마다 같은 번호 시험)
    if (req.url === '/sent') return send(200, sent);
    send(404, {});
  });
}).listen(port + 2, '127.0.0.1');
