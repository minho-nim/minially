import type { Locator } from '@playwright/test';
export async function presetAction(row: Locator, name: string) {
 const target=row.getByRole('button',{name,exact:true});
 if(!await target.isVisible()) await row.getByRole('button',{name:'프리셋 추가 작업',exact:true}).click();
 await target.click();
}

export async function presetMode(root: Locator, mode: 'replace'|'append') {
 const select=root.getByLabel('프리셋 적용 방식',{exact:true});
 if(!await select.isVisible())await root.getByLabel('프리셋 적용 옵션',{exact:true}).click();
 await select.selectOption(mode);
}

export async function presetSearch(root: Locator) {
 const search=root.getByRole('searchbox',{name:'프리셋 검색',exact:true});
 if(!await search.isVisible())await root.getByRole('button',{name:'프리셋 검색 열기',exact:true}).click();
 return search;
}
export async function saveCurrentTitle(root: Locator) {
 const save=root.getByRole('button',{name:'프리셋으로 저장',exact:true});
 if(!await save.isVisible())await root.getByRole('button',{name:'+ 상세 옵션 (메모)',exact:true}).click();
 await save.click();
}

/** 프리셋 창에서 그룹 펼치기(11-04 #8·#10부터 그룹을 눌러야 목록이 보임). 이름을 안 주면 펼쳐진 게 없을 때 첫 그룹 */
export async function openGroup(root: Locator, name?: string) {
  const groups = root.getByRole('group', { name: '프리셋 그룹 선택' });
  await groups.waitFor();
  if (name) { await groups.getByRole('button', { name: new RegExp('^' + name + ' \\d+개') }).click(); return; }
  if (await groups.locator('button[aria-pressed="true"]').count()) return;
  await groups.getByRole('button', { name: /\d+개$/ }).first().click();
}
