import {test,expect} from '@playwright/test';
for(const width of [390,1280]){
 test.describe(`compact connected overlays ${width}`,()=>{
  test.use({viewport:{width,height:844}});
  test('search dismisses outside and presets stay alongside an editable focused composer',async({page})=>{
   await page.goto('/');await page.getByRole('button',{name:'일정 등록',exact:true}).waitFor();
   await page.evaluate(async()=>{
    const path='/src/db/indexedDB.ts',db=await import(path);
    await db.importAllData({categories:[{id:'work',name:'업무',color:'#B4A2D3',isUserManaged:true}],presets:[{id:'focus',type:'title',text:'집중'},{id:'meeting',type:'title',text:'회의'}],schedules:[],recurrenceRules:[],recurrenceExceptions:[]});
   });await page.reload();
   const toolbar=page.getByRole('group',{name:'일정 만들기'}),header=page.locator('header').first();
   for(const name of ['프리셋','카테고리','일정 등록'])expect((await toolbar.getByRole('button',{name,exact:true}).boundingBox())!.height).toBeLessThanOrEqual(32);
   const a=(await toolbar.boundingBox())!,b=(await header.boundingBox())!;expect(a.y-b.y-b.height).toBeLessThanOrEqual(6);
   await page.getByRole('button',{name:width<768?'검색':'일정 검색',exact:true}).filter({visible:true}).first().click();
   const search=page.getByRole('dialog',{name:'일정 검색',exact:true});await search.getByRole('searchbox',{name:'일정 검색어'}).fill('검색 유지');
   await search.getByRole('heading',{name:'일정 검색',exact:true}).click();await expect(search).toBeVisible();
   await search.click({position:{x:2,y:2}});await expect(search).toHaveCount(0);await expect(page.getByRole('dialog')).toHaveCount(0);
   await page.locator('[data-calendar-date]').nth(15).click({position:{x:5,y:5}});
   const sheet=page.getByRole('dialog',{name:'날짜별 일정',exact:true});await sheet.getByRole('button',{name:'일정 등록하기',exact:true}).click();
   await sheet.getByRole('group',{name:'카테고리 목록'}).getByRole('button',{name:'업무',exact:true}).click();
   const title=sheet.getByRole('textbox',{name:'빠른 일정 제목'}),form=sheet.getByRole('form',{name:'빠른 일정 등록'});
   await title.fill('초안');await expect(title).toBeFocused();
   await title.evaluate(el=>{(window as any).composerBlurCount=0;el.addEventListener('blur',()=>{(window as any).composerBlurCount++;});});
   await form.getByRole('button',{name:'프리셋',exact:true}).click();
   await expect(title).toBeVisible();await expect(title).toBeFocused();expect(await page.evaluate(()=>(window as any).composerBlurCount)).toBe(0);
   const picker=sheet.locator('[data-composer-presets]');await expect(picker).toBeVisible();
   await picker.locator('[data-inline-preset="focus"]').click();await expect(title).toHaveValue('초안 집중');await expect(title).toBeFocused();
   await title.fill('직접 수정 집중');await picker.locator('[data-inline-preset="meeting"]').click();
   await expect(title).toHaveValue('직접 수정 집중 회의');await expect(title).toBeFocused();
   expect(await title.evaluate(el=>(el as HTMLInputElement).selectionStart===(el as HTMLInputElement).value.length)).toBe(true);
   await title.press('Enter');await expect(title).toHaveValue('');await expect(title).toBeFocused();await expect(picker).toBeVisible();
   const saved=await page.evaluate(async()=>{const path='/src/db/indexedDB.ts';return(await import(path)).getAllSchedules();});expect(saved).toHaveLength(1);expect(saved[0]).toMatchObject({title:'직접 수정 집중 회의',category:'work'});
   expect(await page.evaluate(()=>(window as any).composerBlurCount)).toBe(0);
   await page.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>500});window.visualViewport!.dispatchEvent(new Event('resize'));});
   await expect(sheet).toHaveAttribute('data-keyboard-open','true');
   await expect.poll(async()=>{const r=(await title.boundingBox())!;return r.y+r.height;}).toBeLessThanOrEqual(500);
   expect(await sheet.evaluate(el=>getComputedStyle(el).boxShadow)).toContain(`${Math.max(width,844)}px`);
   await page.screenshot({path:`test-results/persistent-presets-dim-${width}.png`});
  });
 });
}
