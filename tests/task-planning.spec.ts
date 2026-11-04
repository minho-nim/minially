import { test, expect } from '@playwright/test';
for (const width of [390,1280]) {
  test.describe(`task planning ${width}`,()=>{
    test.use({viewport:{width,height:844}});
    test('reschedule, completion, and bring forward preserve task details',async({page})=>{
      await page.goto('/');await page.getByRole('button',{name:'일정 등록',exact:true}).waitFor();
      const dates=await page.evaluate(async()=>{
        const path='/src/db/indexedDB.ts',db=await import(path);
        const fmt=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const now=new Date(),before=new Date(now),after=new Date(now);before.setDate(before.getDate()-1);after.setDate(after.getDate()+1);
        const today=fmt(now),past=fmt(before),future=fmt(after);
        const base={status:'todo',priority:'high',memo:'유지할 메모',checklist:[{id:'check',text:'준비',done:true}]};
        await db.importAllData({tasks:[{...base,id:'today',title:'옮길 할 일',dueDate:today},{...base,id:'past',title:'어제 미완료',dueDate:past},{...base,id:'done',title:'어제 완료',dueDate:past,status:'done'},{...base,id:'undated',title:'미리 적어둔 일'}],schedules:[],recurrenceRules:[],recurrenceExceptions:[]});
        return {today,past,future};
      });
      await page.reload();await page.getByRole('button',{name:'할 일',exact:true}).filter({visible:true}).first().click();
      await page.getByRole('button',{name:'옮길 할 일 날짜 변경',exact:true}).click();
      const editor=page.getByRole('dialog',{name:'할 일 날짜 변경',exact:true});
      await editor.getByRole('button',{name:'내일',exact:true}).click();await editor.getByRole('button',{name:'날짜 저장'}).click();await expect(editor).toHaveCount(0);
      await expect(page.getByRole('button',{name:'예정',exact:true})).toHaveAttribute('aria-pressed','true');
      await expect(page.locator('[data-task-id="today"]')).toContainText(dates.future);
      await page.getByRole('button',{name:'완료',exact:true}).click();
      await page.getByRole('button',{name:'가져오기',exact:true}).click();
      const bring=page.getByRole('dialog',{name:'미완료 할 일 가져오기'});
      await expect(bring.getByText('어제 미완료',{exact:true})).toBeVisible();await expect(bring.getByText('어제 완료',{exact:true})).toHaveCount(0);await expect(bring.getByText('옮길 할 일',{exact:true})).toHaveCount(0);
      await bring.getByRole('button',{name:'어제 미완료 오늘로 가져오기'}).click();await expect(bring.getByText('어제 미완료',{exact:true})).toHaveCount(0);
      await bring.getByRole('button',{name:'할 일 날짜 팝업 닫기'}).click();
      const row=page.locator('[data-task-id="past"]');await expect(row).toContainText(dates.today);
      await row.getByRole('button',{name:'어제 미완료 완료',exact:true}).click();await expect(row).toHaveCount(0);
      await page.getByRole('button',{name:'완료',exact:true}).click();await expect(row).toBeVisible();await expect(row.locator('p').first()).toHaveClass(/line-through/);
      const saved=await page.evaluate(async()=>{const path='/src/db/indexedDB.ts';return (await import(path)).getAllTasks();});
      expect(saved).toHaveLength(4);expect(saved.find((t:any)=>t.id==='past')).toMatchObject({dueDate:dates.today,status:'done',memo:'유지할 메모',checklist:[{id:'check',text:'준비',done:true}]});
      await page.reload();await page.getByRole('button',{name:'할 일',exact:true}).filter({visible:true}).first().click();await page.getByRole('button',{name:'예정',exact:true}).click();await expect(page.locator('[data-task-id="today"]')).toContainText(dates.future);
    });
  });
}
