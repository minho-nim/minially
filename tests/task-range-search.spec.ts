import { test, expect } from '@playwright/test';
import { chooseDate } from './helpers/date';
for (const width of [390,1280]) {
  test.describe(`ranges and compact UI ${width}`,()=>{
    test.use({viewport:{width,height:844}});
    test('inclusive task ranges, ordered filters, completed styling and search periods',async({page})=>{
      await page.goto('/');await page.getByRole('button',{name:'일정 등록',exact:true}).waitFor();
      const dates=await page.evaluate(async()=>{
        const path='/src/db/indexedDB.ts',db=await import(path),fmt=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const a=new Date(),b=new Date(a),c=new Date(a);b.setDate(b.getDate()+2);c.setDate(c.getDate()+5);
        const dates={start:fmt(a),end:fmt(b),outside:fmt(c)};
        const base={priority:'medium',checklist:[]};
        await db.importAllData({tasks:[{...base,id:'a',title:'첫날 미완료',dueDate:dates.start,status:'todo'},{...base,id:'b',title:'마지막날 완료',dueDate:dates.end,status:'done'},{...base,id:'c',title:'범위 밖',dueDate:dates.outside,status:'todo'}],schedules:[{id:'s1',title:'기간 첫 일정',date:dates.start,category:'',completed:false},{id:'s2',title:'기간 끝 일정',date:dates.end,category:'',completed:true},{id:'s3',title:'범위 밖 일정',date:dates.outside,category:'',completed:false}],recurrenceRules:[],recurrenceExceptions:[]});return dates;
      });
      await page.reload();await page.getByRole('button',{name:'할 일',exact:true}).filter({visible:true}).first().click();
      const filters=page.getByRole('group',{name:'할 일 완료 필터'});
      await expect(filters.getByRole('button')).toHaveText(['모두','미완료','완료']);
      await expect(filters.getByRole('button',{name:'모두',exact:true})).toHaveAttribute('aria-pressed','true');
      await expect(page.getByRole('button',{name:'날짜 미정',exact:true})).toHaveCount(0);
      const range=page.getByRole('region',{name:'할 일 날짜 및 기간 선택'});
      await expect(range).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await range.getByRole('button',{name:'기간',exact:true}).click();
      await chooseDate(range,'조회 종료일',dates.end);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.locator('[data-task-id]')).toHaveCount(2);
      const done=page.locator('[data-task-id="b"]');await expect(done).toHaveClass(/bg-app-soft/);await expect(done.locator('p').first()).toHaveClass(/line-through/);await expect(done.getByText('완료',{exact:true})).toBeVisible();
      await filters.getByRole('button',{name:'완료',exact:true}).click();await expect(page.locator('[data-task-id]')).toHaveCount(1);
      await filters.getByRole('button',{name:'모두',exact:true}).click();await expect(page.locator('[data-task-id]')).toHaveCount(2);
      await page.screenshot({path:`test-results/tasks-range-${width}.png`});
      await range.getByRole('button',{name:'오늘',exact:true}).click();
      await expect(range.getByRole('button',{name:'오늘',exact:true})).toHaveAttribute('aria-pressed','true');
      await expect(page.locator('[data-task-id]')).toHaveCount(1);
      await expect(range.getByRole('button',{name:'조회 종료일',exact:true})).toHaveCount(0);
      expect(await page.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
      await page.getByRole('button',{name:width<768?'검색':'일정 검색',exact:true}).filter({visible:true}).first().click();
      const search=page.getByRole('dialog',{name:'일정 검색',exact:true});
      expect((await search.boundingBox())!.height).toBeGreaterThanOrEqual(230);
      await search.getByText('기간 검색',{exact:true}).click();
      await chooseDate(search,'검색 시작일',dates.start);await chooseDate(search,'검색 종료일',dates.end);
      await expect(search.getByRole('button',{name:/기간 첫 일정/})).toBeVisible();
      await expect(search.getByRole('button',{name:/기간 끝 일정/})).toBeVisible();
      await expect(search.getByRole('button',{name:/범위 밖 일정/})).toHaveCount(0);
      await page.screenshot({path:`test-results/search-range-${width}.png`});
      expect(await search.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    });
  });
}
