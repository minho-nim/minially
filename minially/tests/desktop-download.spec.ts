import {test,expect} from '@playwright/test';
for(const width of [1400,400])test(`웹 설정에서 앱 다운로드 제공 · ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
 await page.getByRole('button',{name:width===400?'설정':'설정 및 프리셋',exact:true}).filter({visible:true}).click();
 const settings=page.getByRole('dialog',{name:'설정',exact:true});await settings.getByRole('button',{name:'앱 설치',exact:true}).click();
 await expect(settings.getByRole('link',{name:'Windows 앱 다운로드'})).toHaveAttribute('href','https://github.com/minho-nim/minihub/releases/latest/download/Minially-Setup.exe');
 await expect(settings.getByRole('region',{name:'Windows 앱 다운로드'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);await page.screenshot({path:`test-results/desktop-download-${width}.png`});
});
