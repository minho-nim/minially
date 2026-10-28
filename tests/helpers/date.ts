import { expect, type Page, type Locator } from '@playwright/test';
type Scope = Page | Locator;
export async function chooseDate(scope: Scope, label: string, value: string) {
  const [year, month] = value.split('-');
  await scope.getByRole('button', { name: label, exact: true }).click();
  const calendar = scope.getByRole('group', { name: label + ' 달력', exact: true });
  await calendar.getByLabel(label + ' 연도', { exact: true }).selectOption(year);
  await calendar.getByLabel(label + ' 월', { exact: true }).selectOption(String(Number(month)));
  await calendar.getByRole('button', { name: value + ' 선택', exact: true }).click();
}
export async function readDate(scope: Scope, label: string) {
  const text = await scope.getByRole('button', { name: label, exact: true }).innerText();
  const match = text.match(/(\d+)년\s*(\d+)월\s*(\d+)일/);
  if (!match) throw new Error('선택된 날짜 없음: ' + text);
  return match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0');
}
export async function expectDate(scope: Scope, label: string, value: string) {
  const [year, month, day] = value.split('-').map(Number);
  await expect(scope.getByRole('button', { name: label, exact: true })).toContainText(`${year}년 ${month}월 ${day}일`);
}
