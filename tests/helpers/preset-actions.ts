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
