import {test,expect,Page} from '@playwright/test';
import type {AppData} from '../src/types';
import {expectDate} from './helpers/date';
async function read(page:Page):Promise<AppData>{return page.evaluate(async()=>{const path='/src/db/indexedDB.ts';return(await import(path)).exportAllData();});}
test.beforeEach(async({page})=>{
 await page.route('**/fonts.googleapis.com/**',r=>r.abort());await page.goto('/',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'일정 등록',exact:true}).waitFor();
 await page.evaluate(async()=>{const path='/src/db/indexedDB.ts';await(await import(path)).importAllData({schedules:[],presets:['자료','준비'].map((text,i)=>({id:'p'+i,text,type:'title',isFavorite:false,usageCount:0,createdAt:1,updatedAt:1})),categories:[{id:'cat',name:'내 분류',color:'#CF8FA8'}]});});await page.reload({waitUntil:'domcontentloaded'});
});
for(const width of [320,390,1280])test.describe(width+'px 날짜 메뉴',()=>{
 test.use({viewport:{width,height:844},isMobile:width<640,hasTouch:width<640});
 test('달력 가장자리 메뉴 전체 노출·위치 보정·바깥 클릭 차단·Escape·등록 연결',async({page})=>{
  const cells=page.locator('[data-calendar-date]'),menu=page.getByRole('group',{name:'날짜 작업 메뉴'}),sheet=page.getByRole('dialog',{name:'날짜별 일정',exact:true});
  const openMenu=async(cell:import('@playwright/test').Locator)=>{if(width<640){await cell.click({position:{x:5,y:5}});const trigger=sheet.getByRole('button',{name:'날짜 작업',exact:true});await trigger.click();return trigger;}const trigger=cell.getByRole('button',{name:'날짜 작업',exact:true});await trigger.click();return trigger;};
  for(const index of [0,6,(await cells.count())-7,(await cells.count())-1]){
   const cell=cells.nth(index),trigger=await openMenu(cell);await expect(menu).toBeVisible();expect(await menu.evaluate(e=>Boolean(e.closest('[aria-modal="true"]')))).toBe(width<640);const box=(await menu.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(7);expect(box.x+box.width).toBeLessThanOrEqual(width-7);expect(box.y).toBeGreaterThanOrEqual(7);expect(box.y+box.height).toBeLessThanOrEqual(844-7);
   for(const button of await menu.getByRole('button').all()){await expect(button).toBeInViewport({ratio:1});expect(await button.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);}
   if(width<640){expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);await expect(cell.getByRole('button',{name:'날짜 작업',exact:true})).toHaveCount(0);const nav=(await page.getByRole('navigation',{name:'하단 메뉴'}).boundingBox())!;expect(box.y+box.height).toBeLessThanOrEqual(nav.y-7);await expect(sheet.locator('.day-sheet')).toHaveCSS('border-bottom-left-radius','16px');}
   await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(trigger).toBeFocused();if(width<640)await sheet.getByRole('button',{name:'날짜 팝업 닫기'}).click();
  }
  const last=cells.last();await openMenu(last);await page.mouse.click(5,100);await expect(menu).toHaveCount(0);if(width<640){await expect(sheet).toBeVisible();await sheet.getByRole('button',{name:'날짜 팝업 닫기'}).click();}else await expect(page.getByRole('dialog')).toHaveCount(0);
  const date=(await last.getAttribute('data-calendar-date'))!;await openMenu(last);await menu.getByRole('button',{name:width<640?'여러 날짜 등록':'일정 추가',exact:true}).click();const editor=page.getByRole('dialog',{name:'새 일정',exact:true});if(width<640)await editor.locator('[data-schedule-panel]').getByRole('button',{name:'뒤로',exact:true}).click();await expectDate(editor,'일정 날짜',date);await expect(menu).toHaveCount(0);await editor.getByRole('button',{name:'취소',exact:true}).click();if(width<640)await sheet.getByRole('button',{name:'날짜 팝업 닫기'}).click();await openMenu(last);await page.screenshot({path:'test-results/calendar-date-menu-'+width+'.png'});

 });
});
test.describe('PC 간편 일정 등록',()=>{
 test.use({viewport:{width:1280,height:900}});
 test('날짜 클릭으로 동일한 간편 팝업·프리셋·카테고리·중요·연속 등록 제공',async({page})=>{
  const date=(await page.locator('[data-calendar-date]').nth(15).getAttribute('data-calendar-date'))!;await page.locator('[data-calendar-date="'+date+'"]').click({position:{x:5,y:5}});const sheet=page.getByRole('dialog',{name:'날짜별 일정',exact:true});await expect(sheet).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(1);const box=(await sheet.locator('.day-sheet').boundingBox())!;expect(box.width).toBeLessThanOrEqual(600);expect(box.x).toBeGreaterThan(0);expect(box.y).toBeGreaterThan(0);expect(box.y+box.height).toBeLessThan(900);
  await sheet.getByRole('button',{name:'일정 추가',exact:true}).click();const title=sheet.getByLabel('빠른 일정 제목',{exact:true});await title.fill('직접');await sheet.getByRole('button',{name:'빠른 등록 카테고리 선택'}).click();await sheet.getByRole('button',{name:'내 분류',exact:true}).click();await sheet.getByRole('button',{name:'중요 일정',exact:true}).click();await sheet.getByRole('button',{name:'프리셋',exact:true}).click();const picker=sheet.locator('[data-inline-presets]');await picker.getByRole('button',{name:'자료',exact:true}).click();await picker.getByRole('button',{name:'준비',exact:true}).click();await expect(title).toHaveValue('직접 자료 준비');await expect(picker).toBeVisible();await title.press('Enter');await expect(title).toHaveValue('');await expect(title).toBeFocused();await expect(sheet).toBeVisible();await expect(page.getByRole('status',{name:'등록 완료 알림'})).toContainText('직접 자료 준비');expect((await read(page)).schedules[0]).toMatchObject({title:'직접 자료 준비',category:'cat',isImportant:true,date});
  await title.fill('두 번째');await title.press('Enter');await expect(title).toHaveValue('');expect((await read(page)).schedules).toHaveLength(2);await sheet.getByRole('button',{name:'날짜 팝업 닫기'}).click();await expect(sheet).toHaveCount(0);expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');await page.locator('[data-calendar-date="'+date+'"]').click({position:{x:5,y:5}});await expect(sheet.getByText('직접 자료 준비',{exact:true})).toBeVisible();await page.screenshot({path:'test-results/desktop-day-popup.png'});
 });
});
