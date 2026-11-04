import { test, expect } from '@playwright/test';
for (const width of [390,1280]) {
  test.describe(`task date navigation ${width}`,()=>{
    test.use({viewport:{width,height:844}});
    test('navigate dates, import calendar events, and retain quick-entry focus',async({page})=>{
      await page.goto('/');await page.getByRole('button',{name:'일정 등록',exact:true}).waitFor();
      const dates=await page.evaluate(async()=>{
        const path='/src/db/indexedDB.ts',db=await import(path);
        const fmt=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const today=new Date(),past=new Date(today),future=new Date(today);past.setDate(past.getDate()-1);future.setDate(future.getDate()+1);
        const dates={today:fmt(today),past:fmt(past),future:fmt(future)};
        await db.importAllData({tasks:[],schedules:[{id:'future',title:'내일 일정',date:dates.future,category:'',completed:false},{id:'past',title:'어제 일정',date:dates.past,category:'',completed:false}],recurrenceRules:[],recurrenceExceptions:[]});return dates;
      });
      await page.reload();await page.getByRole('button',{name:'할 일',exact:true}).filter({visible:true}).first().click();
      await expect(page.getByRole('button',{name:'예정',exact:true})).toHaveCount(0);
      await page.getByRole('button',{name:'다음 날짜 할 일'}).click();
      await page.getByRole('button',{name:'캘린더 일정 가져오기'}).click();
      const dialog=page.getByRole('dialog',{name:'캘린더 일정 가져오기'});
      await expect(dialog.getByRole('article')).toContainText('내일 일정');
      await dialog.getByRole('button',{name:'내일 일정 일정 가져오기',exact:true}).click();
      await expect(dialog.getByRole('button',{name:'내일 일정 일정 가져오기',exact:true})).toBeDisabled();
      await dialog.getByRole('button',{name:'일정 가져오기 닫기'}).click();
      await expect(page.getByText('내일 일정',{exact:true})).toBeVisible();
      const title=page.getByRole('textbox',{name:'새 할 일 제목'});
      await title.fill('내일 미리 작성');
      await title.evaluate(el=>{
        (window as any).entryBlur=0;(window as any).entryDisabled=false;
        el.addEventListener('blur',()=>{(window as any).entryBlur++;});
        new MutationObserver(()=>{if((el as HTMLInputElement).disabled)(window as any).entryDisabled=true;}).observe(el,{attributes:true,attributeFilter:['disabled']});
      });
      await title.press('Enter');await expect(title).toHaveValue('');await expect(title).toBeFocused();
      expect(await page.evaluate(()=>(window as any).entryBlur)).toBe(0);
      expect(await page.evaluate(()=>(window as any).entryDisabled)).toBe(false);
      const tasks=await page.evaluate(async()=>{const path='/src/db/indexedDB.ts';return (await import(path)).getAllTasks();});
      expect(tasks.find((t:any)=>t.title==='내일 미리 작성')?.dueDate).toBe(dates.future);
      await page.getByRole('button',{name:'이전 날짜 할 일'}).click();await expect(page.getByText('내일 일정',{exact:true})).toHaveCount(0);
      await page.getByRole('button',{name:'이전 날짜 할 일'}).click();
      await title.fill('어제 할 일');await title.press('Enter');await expect(title).toHaveValue('');
      const saved=await page.evaluate(async()=>{const path='/src/db/indexedDB.ts';return (await import(path)).getAllTasks();});
      expect(saved.find((t:any)=>t.title==='어제 할 일')?.dueDate).toBe(dates.past);
      await expect(page.getByRole('button',{name:'날짜 미정',exact:true})).toHaveCount(0);
    });
  });
}
