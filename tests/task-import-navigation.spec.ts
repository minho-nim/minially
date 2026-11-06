import {test,expect,type Locator,type Page} from '@playwright/test';
import {chooseDate,expectDate} from './helpers/date';
async function swipe(page:Page,surface:Locator,direction:'left'|'right'){
 const b=(await surface.boundingBox())!,start=b.x+b.width*(direction==='left'?.72:.28),end=b.x+b.width*(direction==='left'?.28:.72),y=b.y+b.height*.8;
 const c=await page.context().newCDPSession(page);
 await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y}]});
 for(let i=1;i<=6;i++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start+(end-start)*i/6,y}]});
 await expect(surface).toHaveAttribute('data-swipe-phase','dragging');
 await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();await expect(surface).toHaveAttribute('data-swipe-phase','idle');
}
for(const width of [390,1280]){
 test.describe(`connected task navigation ${width}`,()=>{
  test.use({viewport:{width,height:844},hasTouch:true});
  test('import shares day and range navigation, and populated tasks grow in the page',async({page})=>{
   await page.goto('/');await page.getByRole('button',{name:'일정 등록',exact:true}).waitFor();
   const dates=await page.evaluate(async()=>{
    const path='/src/db/indexedDB.ts',db=await import(path),fmt=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const a=new Date(),b=new Date(a),c=new Date(a);b.setDate(b.getDate()+1);c.setDate(c.getDate()+2);
    const dates={today:fmt(a),next:fmt(b),after:fmt(c)};
    await db.importAllData({tasks:Array.from({length:10},(_,i)=>({id:'task-'+i,title:'미리 등록한 할 일 '+i,dueDate:dates.today,status:'todo',priority:'medium',checklist:[]})),schedules:[{id:'a',title:'오늘 일정',date:dates.today,category:'',completed:false},{id:'b',title:'다음 날 일정',date:dates.next,category:'',completed:false},{id:'c',title:'기간 끝 일정',date:dates.after,category:'',completed:false}],recurrenceRules:[],recurrenceExceptions:[]});return dates;
   });
   await page.reload();await page.getByRole('button',{name:'할 일',exact:true}).filter({visible:true}).first().click();
   const list=page.locator('[data-task-swipe]');await expect(page.locator('[data-task-id]')).toHaveCount(10);
   await expect.poll(async()=>(await list.boundingBox())!.height).toBeGreaterThan(400);
   const content=list.locator('[data-task-list]');expect(await content.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
   await page.getByRole('button',{name:'캘린더 일정 가져오기',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'캘린더 일정 가져오기',exact:true}),nav=dialog.getByRole('region',{name:'일정 가져오기 날짜 및 기간 선택'}),pager=dialog.locator('[data-import-swipe]');
   await expect(nav.getByRole('group',{name:'조회 방식'}).getByRole('button')).toHaveText(['하루','기간']);
   await expectDate(nav,'가져올 일정 날짜',dates.today);
   await swipe(page,pager,'left');await expectDate(nav,'가져올 일정 날짜',dates.next);
   await expect(dialog.getByRole('article')).toContainText('다음 날 일정');
   await dialog.getByRole('button',{name:'다음 날 일정 일정 가져오기',exact:true}).click();
   await expect(dialog.getByRole('button',{name:'다음 날 일정 일정 가져오기',exact:true})).toBeDisabled();
   await dialog.getByRole('button',{name:'일정 가져오기 닫기'}).click();
   await expectDate(page,'조회 날짜',dates.next);await expect(page.locator('[data-task-id]')).toHaveCount(1);await expect(page.getByText('다음 날 일정',{exact:true})).toBeVisible();
   await page.getByRole('button',{name:'캘린더 일정 가져오기',exact:true}).click();
   await swipe(page,pager,'right');await expectDate(nav,'가져올 일정 날짜',dates.today);
   await nav.getByRole('button',{name:'오늘',exact:true}).click();
   await nav.getByRole('button',{name:'기간',exact:true}).click();await chooseDate(nav,'조회 시작일',dates.next);await chooseDate(nav,'조회 종료일',dates.after);
   await expect(dialog.getByRole('article')).toHaveCount(2);await expect(dialog.getByRole('button',{name:'오늘 일정 일정 가져오기',exact:true})).toHaveCount(0);
   await dialog.getByRole('button',{name:'기간 끝 일정 일정 가져오기',exact:true}).click();
   await dialog.getByRole('button',{name:'일정 가져오기 닫기'}).click();
   await expectDate(page,'조회 시작일',dates.next);await expectDate(page,'조회 종료일',dates.after);await expect(page.locator('[data-task-id]')).toHaveCount(2);
   await page.getByRole('button',{name:'오늘',exact:true}).click();await expect(page.locator('[data-task-id]')).toHaveCount(10);
   await expect.poll(async()=>(await list.boundingBox())!.height).toBeGreaterThan(400);
   await page.screenshot({path:`test-results/tasks-growing-${width}.png`});
   expect(await page.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  });
 });
}
