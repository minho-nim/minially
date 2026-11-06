import {test,expect} from '@playwright/test';
for(const width of [390,1280]){
 test.describe(`week schedule capacity ${width}`,()=>{
  test.use({viewport:{width,height:844},hasTouch:true});
  test('show every schedule and scroll within a day while preserving week swipes',async({page})=>{
   await page.goto('/');await page.getByRole('button',{name:'일정 등록',exact:true}).waitFor();
   const date=await page.evaluate(async()=>{
    const path='/src/db/indexedDB.ts',db=await import(path),d=new Date();
    const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    await db.importAllData({categories:[{id:'work',name:'업무',color:'#B4A2D3',isUserManaged:true}],schedules:Array.from({length:24},(_,i)=>({id:'week-'+i,title:'주간 일정 '+String(i+1).padStart(2,'0'),date,category:'work',completed:false,startTime:`${String(8+Math.floor(i/4)).padStart(2,'0')}:${String((i%4)*15).padStart(2,'0')}`,endTime:''})),recurrenceRules:[],recurrenceExceptions:[]});return date;
   });
   await page.reload();await page.getByRole('button',{name:'주간',exact:true}).click();
   const column=page.locator(`[data-week-schedules="${date}"]`);
   await expect(column.locator('[data-week-schedule]')).toHaveCount(24);
   expect(await column.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
   const box=(await column.boundingBox())!;
   const visible=await column.locator('[data-week-schedule]').evaluateAll((els,b)=>els.filter(el=>{const r=el.getBoundingClientRect();return r.top>=b.y&&r.bottom<=b.y+b.height;}).length,box);
   expect(visible).toBeGreaterThan(2);
   await column.evaluate(el=>{el.scrollTop=el.scrollHeight;});
   const last=column.locator('[data-week-schedule]').last(),lastBounds=(await last.boundingBox())!;
   expect(lastBounds.y+lastBounds.height).toBeLessThanOrEqual(box.y+box.height+1);
   await page.screenshot({path:`test-results/week-capacity-${width}.png`});
   await last.click();await expect(page.getByRole('dialog',{name:'일정 수정',exact:true})).toBeVisible();
   await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
   const heading=page.locator('.calendar-view h2'),before=await heading.innerText();
   const session=await page.context().newCDPSession(page),y=box.y+box.height/2,x=box.x+box.width*.7;
   await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let i=1;i<=6;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*20,y}]});
   await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();
   await expect(heading).not.toHaveText(before);
   await expect(page.getByRole('dialog')).toHaveCount(0);
   expect(await page.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  });
 });
}
