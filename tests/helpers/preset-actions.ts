import type { Locator } from '@playwright/test';
export async function presetAction(row: Locator, name: string) {
 const target=row.getByRole('button',{name,exact:true});
 if(!await target.isVisible()) await row.getByRole('button',{name:'프리셋 추가 작업',exact:true}).click();
 await target.click();
}
