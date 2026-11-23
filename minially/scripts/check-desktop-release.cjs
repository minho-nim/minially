const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const version=require('../desktop/package.json').version;
const root=path.resolve('desktop-dist'),installer=fs.readFileSync(path.join(root,'Minially-Setup.exe')),feed=fs.readFileSync(path.join(root,'latest.yml'),'utf8');
assert.equal(installer.subarray(0,2).toString(),'MZ');assert.ok(installer.length>10*1024*1024);assert.ok(fs.statSync(path.join(root,'Minially-Setup.exe.blockmap')).size>100);
assert.ok(feed.includes(`version: ${version}`));assert.ok(feed.includes('Minially-Setup.exe'));assert.ok(feed.includes(crypto.createHash('sha512').update(installer).digest('base64')));assert.ok(!feed.includes('localhost'));
console.log(`Windows ${version}: 설치 파일·블록맵·SHA512 확인 완료`);
