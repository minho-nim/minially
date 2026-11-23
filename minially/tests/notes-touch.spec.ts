import {test,expect} from '@playwright/test';
test.use({viewport:{width:390,height:844},hasTouch:true});
test('모바일에서 굵게를 먼저 켜고 입력한 내용이 서식과 함께 저장된다',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).tap();await page.getByRole('button',{name:'새 메모',exact:true}).tap();
 const body=page.getByRole('textbox',{name:'메모 본문',exact:true});await body.tap();await page.getByRole('button',{name:'굵게',exact:true}).tap();await expect(body).toBeFocused();await page.keyboard.insertText('모바일 굵은 글씨');await expect(body.locator('b,strong')).toHaveText('모바일 굵은 글씨');
 await page.reload();await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).tap();await page.locator('[data-note-id]').tap();await expect(body.locator('b,strong')).toHaveText('모바일 굵은 글씨');
});

test('선택 후 터치로 서식·목록·정렬·취소·복구를 적용하고 중복 실행하지 않는다',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).tap();await page.getByRole('button',{name:'새 메모',exact:true}).tap();const body=page.getByRole('textbox',{name:'메모 본문',exact:true}),toolbar=page.getByRole('toolbar',{name:'메모 글자 서식'});await body.fill('서식을 확인하는 글');
 const select=async()=>body.evaluate(el=>{el.focus();const range=document.createRange();range.selectNodeContents(el);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);});
 const saved=()=>page.evaluate(async()=>{const path='/src/db/indexedDB.ts';return(await import(path)).getAllNotes();});
 for(const [label,key] of [['굵게','bold'],['밑줄','underline'],['취소선','strike']] as const){await select();await toolbar.getByRole('button',{name:label,exact:true}).tap();await expect.poll(async()=>(await saved())[0].richBody?.[0][key]).toBe(true);await toolbar.getByRole('button',{name:label,exact:true}).tap();await expect.poll(async()=>!!(await saved())[0].richBody?.[0][key]).toBe(false);}
 await toolbar.getByRole('button',{name:'서식 더 보기',exact:true}).tap();await expect(toolbar.getByRole('button',{name:'서식 더 보기',exact:true})).toHaveAttribute('aria-expanded','true');
 await select();await toolbar.getByRole('button',{name:'기울임',exact:true}).tap();await expect.poll(async()=>(await saved())[0].richBody?.[0].italic).toBe(true);
 await toolbar.getByRole('button',{name:'위첨자',exact:true}).tap();await expect.poll(async()=>(await saved())[0].richBody?.[0].script).toBe('super');await toolbar.getByRole('button',{name:'아래첨자',exact:true}).tap();await expect.poll(async()=>(await saved())[0].richBody?.[0].script).toBe('sub');
 await toolbar.getByRole('button',{name:'글머리 기호',exact:true}).tap();await expect.poll(async()=>(await saved())[0].richDocument?.[0]).toMatchObject({list:'bullet'});await toolbar.getByRole('button',{name:'실행 취소',exact:true}).tap();await expect.poll(async()=>(await saved())[0].richDocument?.[0]?.list).not.toBe('bullet');await toolbar.getByRole('button',{name:'다시 실행',exact:true}).tap();await expect.poll(async()=>(await saved())[0].richDocument?.[0]).toMatchObject({list:'bullet'});
 await toolbar.getByRole('button',{name:'번호 목록',exact:true}).tap();await toolbar.getByRole('button',{name:'오른쪽 정렬',exact:true}).tap();await expect.poll(async()=>(await saved())[0].richDocument?.[0]).toMatchObject({list:'number',align:'right'});
 await select();await toolbar.getByRole('combobox',{name:'글자 크기',exact:true}).selectOption('18');await expect.poll(async()=>(await saved())[0].richBody?.[0].fontSize).toBe(18);await page.reload();await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).tap();await page.locator('[data-note-id]').tap();expect((await saved())[0].richBody?.[0].fontSize).toBe(18);
});
