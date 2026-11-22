import {test,expect,type Page} from '@playwright/test';
import type {AppData} from '../src/types';
async function data(page:Page):Promise<AppData>{return page.evaluate(async()=>{const path='/src/db/indexedDB.ts';return(await import(path)).exportAllData();});}
for(const width of [400,1400])test.describe(`폴더·등록 카테고리 ${width}`,()=>{
 test.use({viewport:{width,height:900}});
 test('폴더 기본값 자동 적용·등록 시 변경·메모 원본 유지',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'일정 등록',exact:true}).waitFor();
  await page.evaluate(async()=>{const path='/src/db/indexedDB.ts';await(await import(path)).importAllData({categories:[{id:'personal',name:'개인',color:'#CF8FA8'},{id:'work',name:'업무',color:'#B4A2D3'}]});});await page.reload();await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();
  await page.getByRole('button',{name:'분류 추가',exact:true}).click();await page.getByRole('textbox',{name:'분류 이름',exact:true}).fill('출장 기록');await page.getByRole('textbox',{name:'추천 키워드',exact:true}).fill('출장, 항공권');await page.getByLabel('폴더 기본 카테고리',{exact:true}).selectOption('work');await page.getByRole('button',{name:'분류 저장',exact:true}).click();
  const quick=page.getByRole('form',{name:'빠른 메모'});await quick.getByRole('textbox',{name:'빠른 메모 내용'}).fill('출장 항공권 예약 확인');await quick.getByRole('button',{name:'#출장 기록',exact:true}).click();await quick.getByRole('button',{name:'메모 저장',exact:true}).click();
  const editor=page.getByRole('article',{name:'메모 편집기'});await expect(editor.getByLabel('등록 카테고리',{exact:true})).toHaveValue('work');
  await editor.getByLabel('등록 카테고리',{exact:true}).selectOption('personal');await editor.getByRole('button',{name:'할 일로 등록',exact:true}).click();expect((await data(page)).tasks[0].categoryId).toBe('personal');
  await editor.getByRole('button',{name:'일정으로 등록',exact:true}).click();const schedule=page.getByRole('dialog',{name:'새 일정',exact:true});await expect(schedule.getByRole('button',{name:'카테고리 선택',exact:true})).toContainText('개인');await schedule.getByRole('button',{name:'등록',exact:true}).click();await expect(schedule).toHaveCount(0);expect((await data(page)).schedules[0].category).toBe('personal');
  await page.getByRole('button',{name:'할 일',exact:true}).filter({visible:true}).click();await expect(page.locator('[data-task-id]')).toContainText('개인');
  await page.getByRole('button',{name:'원본 메모',exact:true}).click();await expect(editor.getByLabel('메모 본문',{exact:true})).toHaveText('출장 항공권 예약 확인');
  if(width<768)await editor.getByRole('button',{name:'메모 목록으로',exact:true}).click();
  await page.getByRole('complementary',{name:'메모 분류'}).getByRole('button',{name:/출장 기록/}).click();await page.getByRole('button',{name:'폴더 설정',exact:true}).click();await expect(page.getByLabel('폴더 기본 카테고리',{exact:true})).toHaveValue('work');await page.getByLabel('폴더 기본 카테고리',{exact:true}).selectOption('personal');await page.getByRole('button',{name:'분류 저장',exact:true}).click();
  const saved=await data(page);expect(saved.noteFolders?.find(folder=>folder.name==='출장 기록')?.defaultCategoryId).toBe('personal');expect(saved.notes).toHaveLength(1);
 });
});
