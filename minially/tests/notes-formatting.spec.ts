import {test,expect,type Page} from '@playwright/test';
import type {AppData} from '../src/types';
async function data(page:Page):Promise<AppData>{return page.evaluate(async()=>{const path='/src/db/indexedDB.ts';return(await import(path)).exportAllData();});}
async function selectBody(page:Page){await page.getByRole('textbox',{name:'메모 본문',exact:true}).evaluate(el=>{el.focus();const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(el);selection!.removeAllRanges();selection!.addRange(range);});}
for(const width of [400,1400])test.describe(`메일형 메모 서식 ${width}`,()=>{
 test.use({viewport:{width,height:900}});
 test('글자 서식·새로고침·백업 복원·일반 텍스트 할 일 연결',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:'새 메모',exact:true}).click();const body=page.getByRole('textbox',{name:'메모 본문',exact:true});await body.fill('중요한 메모');await selectBody(page);
  const toolbar=page.getByRole('toolbar',{name:'메모 글자 서식'});if(width<768)await toolbar.getByRole('button',{name:'서식 더 보기',exact:true}).click();
  for(const name of ['굵게','기울임','밑줄','취소선'])await toolbar.getByRole('button',{name,exact:true}).click();
  await expect(page.getByRole('status',{name:'메모 저장 상태'})).toHaveText('저장됨');
  let saved=await data(page);expect(saved.notes![0].body).toBe('중요한 메모');expect(saved.notes![0].richBody).toEqual([{text:'중요한 메모',bold:true,italic:true,underline:true,strike:true}]);
  await page.reload();await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await page.locator('[data-note-id]').click();await expect(body).toHaveText('중요한 메모');await expect(body.locator('u')).toHaveCount(1);await expect(body.locator('s')).toHaveCount(1);await expect(body.locator('strong')).toHaveCount(1);
  await page.getByRole('button',{name:'할 일로 등록',exact:true}).click();await page.getByRole('dialog',{name:'메모에서 할 일 등록',exact:true}).getByRole('button',{name:'등록',exact:true}).click();saved=await data(page);expect(saved.tasks[0].memo).toBe('중요한 메모');expect(saved.tasks[0].title).toBe('중요한 메모');
  const restored=await page.evaluate(async()=>{const path='/src/db/indexedDB.ts',db=await import(path),backup=await db.exportAllData();await db.importAllData({notes:[]});await db.importAllData(backup);return db.exportAllData();});expect(restored.notes![0].richBody).toEqual(saved.notes![0].richBody);
  if(width<768)await toolbar.getByRole('button',{name:'서식 더 보기',exact:true}).click();
  await selectBody(page);await toolbar.getByRole('button',{name:'서식 지우기',exact:true}).click();await expect.poll(async()=>(await data(page)).notes![0].richBody).toEqual([{text:'중요한 메모'}]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
 test('줄바꿈과 서식 실행 취소가 본문을 보존한다',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:'새 메모',exact:true}).click();const body=page.getByRole('textbox',{name:'메모 본문',exact:true});await body.fill('첫 줄');await body.press('ControlOrMeta+End');await body.press('Enter');await page.keyboard.insertText('둘째 줄');await body.press('Shift+Enter');await page.keyboard.insertText('셋째 줄');
  await expect.poll(async()=>(await data(page)).notes![0].body).toBe('첫 줄\n둘째 줄\n셋째 줄');await selectBody(page);await page.getByRole('button',{name:'굵게',exact:true}).click();await body.press('ControlOrMeta+z');await expect.poll(async()=>(await data(page)).notes![0].richBody?.some(run=>run.bold)).toBe(false);
 });
 test('붙여넣기는 지원 서식만 보존하고 위험한 태그·이벤트는 저장하지 않는다',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:'새 메모',exact:true}).click();const body=page.getByRole('textbox',{name:'메모 본문',exact:true});await body.focus();
  await body.evaluate(el=>{const clipboard=new DataTransfer();clipboard.setData('text/html','<b>붙여넣기</b><u>밑줄</u><img src="x" onerror="window.pasteExecuted=true"><script>window.pasteExecuted=true</script><a href="javascript:alert(1)">문자</a>');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:clipboard}));});
  await expect(body).toHaveText('붙여넣기밑줄문자');const saved=await data(page);expect(saved.notes![0].body).toBe('붙여넣기밑줄문자');expect(saved.notes![0].richBody).toEqual([{text:'붙여넣기',bold:true},{text:'밑줄',underline:true},{text:'문자'}]);expect(await page.evaluate(()=>(window as any).pasteExecuted)).toBeUndefined();await expect(body.locator('script,img,a')).toHaveCount(0);
  await page.screenshot({path:`test-results/notes-rich-${width}.png`,fullPage:true});
 });
});
