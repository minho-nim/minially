import {test,expect} from '@playwright/test';
import {expectDate} from './helpers/date';
for(const width of [400,1400])test.describe(`연결된 메모·할 일·달력 ${width}`,()=>{
 test.use({viewport:{width,height:900}});
 test('메모→일정→할 일 가져오기→원본과 연결 목록으로 이동',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await page.getByRole('textbox',{name:'빠른 메모 내용'}).fill('회의 자료와 준비 사항');await page.getByRole('button',{name:'메모 저장',exact:true}).click();
  const editor=page.getByRole('article',{name:'메모 편집기'});await editor.getByRole('textbox',{name:'메모 제목',exact:true}).fill('통합 메모');await expect(editor.getByRole('status',{name:'메모 저장 상태'})).toHaveText('저장됨');
  await editor.getByRole('button',{name:'일정으로 등록',exact:true}).click();const schedule=page.getByRole('dialog',{name:'새 일정',exact:true});await schedule.getByRole('button',{name:'등록',exact:true}).click();await expect(schedule).toHaveCount(0);
  await page.getByRole('button',{name:'할 일',exact:true}).filter({visible:true}).click();await page.getByRole('button',{name:'캘린더 일정 가져오기',exact:true}).click();const importing=page.getByRole('dialog',{name:'캘린더 일정 가져오기',exact:true});await importing.getByRole('article').filter({hasText:'통합 메모'}).getByRole('button',{name:'통합 메모 일정 가져오기',exact:true}).click();await importing.getByRole('button',{name:'일정 가져오기 닫기',exact:true}).click();
  const row=page.locator('[data-task-id]').filter({hasText:'통합 메모'});await expect(row.getByRole('button',{name:'원본 메모',exact:true})).toBeVisible();await row.getByRole('button',{name:'원본 일정',exact:true}).click();const edit=page.getByRole('dialog',{name:'일정 수정',exact:true});await expect(edit.getByRole('textbox',{name:'일정 제목',exact:true})).toHaveValue('통합 메모');await edit.getByRole('button',{name:'원본 메모 열기',exact:true}).click();await expect(editor.getByRole('textbox',{name:'메모 본문',exact:true})).toHaveText('회의 자료와 준비 사항');
  await editor.getByText('연결된 항목 · 할 일 1 · 일정 1',{exact:true}).click();await editor.getByRole('button',{name:/통합 메모.*\d{4}-\d{2}-\d{2}/}).first().click();await expect(row).toBeVisible();await row.getByRole('button',{name:'원본 메모',exact:true}).click();await expect(editor).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
});

for(const width of [400,1400])test.describe(`할 일에서 일정 연결 ${width}`,()=>{
 test.use({viewport:{width,height:900}});
 test('할 일을 일정으로 등록한 뒤 원본으로 돌아오고 중복 가져오기를 막는다',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'할 일',exact:true}).filter({visible:true}).click();const input=page.getByRole('textbox',{name:'새 할 일 제목',exact:true});await input.fill('일정으로 연결할 작업');await input.press('Enter');const row=page.locator('[data-task-id]').filter({hasText:'일정으로 연결할 작업'});await row.getByRole('button',{name:'일정으로 등록',exact:true}).click();const schedule=page.getByRole('dialog',{name:'새 일정',exact:true});await expect(schedule.getByRole('textbox',{name:'일정 제목',exact:true})).toHaveValue('일정으로 연결할 작업');await schedule.getByRole('button',{name:'등록',exact:true}).click();await expect(schedule).toHaveCount(0);await row.getByRole('button',{name:'원본 일정',exact:true}).click();const edit=page.getByRole('dialog',{name:'일정 수정',exact:true});await edit.getByRole('button',{name:'원본 할 일 열기',exact:true}).click();await expect(row).toBeVisible();await page.getByRole('button',{name:'캘린더 일정 가져오기',exact:true}).click();const importing=page.getByRole('dialog',{name:'캘린더 일정 가져오기',exact:true});await expect(importing.getByRole('button',{name:'일정으로 연결할 작업 일정 가져오기',exact:true})).toBeDisabled();
 });
});

for(const width of [400,1400])test.describe(`공통 등록 날짜 ${width}`,()=>{
 test.use({viewport:{width,height:900}});
 test('메모에서 고른 날짜가 일정과 할 일에 함께 적용된다',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();await page.getByRole('textbox',{name:'빠른 메모 내용'}).fill('같은 날짜의 작업');await page.getByRole('button',{name:'메모 저장',exact:true}).click();const editor=page.getByRole('article',{name:'메모 편집기'});await editor.getByLabel('등록 날짜',{exact:true}).fill('2026-12-03');await editor.getByRole('button',{name:'일정으로 등록',exact:true}).click();const schedule=page.getByRole('dialog',{name:'새 일정',exact:true});await expectDate(schedule,'일정 날짜','2026-12-03');await schedule.getByRole('button',{name:'등록',exact:true}).click();await expect(schedule).toHaveCount(0);await editor.getByRole('button',{name:'할 일로 등록',exact:true}).click();await editor.getByText('연결된 항목 · 할 일 1 · 일정 1',{exact:true}).click();await editor.getByRole('button',{name:/같은 날짜의 작업.*2026-12-03/}).first().click();await expect(page.locator('[data-task-id]').filter({hasText:'같은 날짜의 작업'})).toBeVisible();
 });
});
