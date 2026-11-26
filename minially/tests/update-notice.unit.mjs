import test from 'node:test';import assert from 'node:assert/strict';
import {isNewerVersion,releaseNoteItems} from '../src/utils/appVersion.ts';
test('버전 비교: 숫자로 비교하고 형식이 틀리면 새 버전으로 보지 않는다',()=>{
 assert.equal(isNewerVersion('0.1.20','0.1.19'),true);assert.equal(isNewerVersion('0.1.10','0.1.9'),true);assert.equal(isNewerVersion('1.0.0','0.9.99'),true);
 assert.equal(isNewerVersion('0.1.19','0.1.19'),false);assert.equal(isNewerVersion('0.1.18','0.1.19'),false);
 for(const bad of ['','dev','0.1','0.1.x','<b>1.0.0</b>'])assert.equal(isNewerVersion(bad,'0.1.0'),false,bad);
});
test('바뀐 점: 릴리스 노트의 - 줄만 최대 8개',()=>{
 assert.deepEqual(releaseNoteItems('미니어리 V.1\n\n- 하나\n- 둘\n설명 줄\n'),['하나','둘']);
 assert.equal(releaseNoteItems(Array.from({length:12},(_,i)=>`- ${i}`).join('\n')).length,8);
});
