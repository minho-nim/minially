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
