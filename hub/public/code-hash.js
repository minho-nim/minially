// 미니어리 서버와 같은 규칙: 대소문자·'-' 무시, O→0, I·L→1
  const normalize = c => c.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  document.getElementById('f').addEventListener('submit', async e => {
    e.preventDefault();
    const out = document.getElementById('out');
    const code = normalize(document.getElementById('code').value);
    if (code.length < 12) { out.textContent = '코드가 너무 짧아요.'; return; }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
    const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    out.textContent = document.getElementById('user').value + ':' + hex;
    document.getElementById('code').value = '';
  });
