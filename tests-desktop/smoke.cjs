const { _electron:electron,expect }=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'minially-desktop-test-'));let app;
 try{
  app=await electron.launch({args:[...(process.platform==='linux'?['--no-sandbox','--headless','--ozone-platform=headless']:[]),path.resolve('desktop')],env:{...process.env,MINIALLY_DESKTOP_TEST:'1',MINIALLY_DESKTOP_TEST_PROFILE:profile},timeout:45000});
  const main=await app.firstWindow();await main.getByRole('button',{name:'메모',exact:true}).filter({visible:true}).click();
  assert.equal(await main.evaluate(()=>typeof window.require),'undefined');assert.equal(await main.evaluate(()=>typeof window.process),'undefined');
  const state=await main.evaluate(()=>window.miniallyDesktop.getState());assert.equal(state.version,'0.1.0');assert.equal(state.preferences.alwaysOnTop,false);
  await main.evaluate(()=>window.miniallyDesktop.updatePreferences({alwaysOnTop:true}));assert.equal((await main.evaluate(()=>window.miniallyDesktop.getState())).preferences.alwaysOnTop,true);if(process.platform==='win32')assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isAlwaysOnTop()),true);
  const rejected=await main.evaluate(async()=>{try{await window.miniallyDesktop.updatePreferences({danger:true});return false;}catch{return true;}});assert.equal(rejected,true);
  const quickReady=app.waitForEvent('window');await main.evaluate(()=>window.miniallyDesktop.showQuick());const quick=await quickReady;
  await quick.getByRole('textbox',{name:'빠른 메모 본문'}).fill('빠른 창에서 쓴 메모를 전체 창에서 확인');
  await expect(quick.getByRole('status')).toContainText('저장됨');
  await expect(main.getByRole('button',{name:/빠른 창에서 쓴 메모를 전체 창에서 확인/})).toBeVisible();
  await quick.getByRole('button',{name:'미니어리 열기'}).click();await expect(main.getByRole('textbox',{name:'메모 본문',exact:true})).toContainText('빠른 창에서 쓴 메모를 전체 창에서 확인');
  await main.getByRole('textbox',{name:'메모 본문',exact:true}).fill('전체 창에서 수정한 내용');await expect(main.getByRole('status',{name:'메모 저장 상태'})).toHaveText('저장됨');
  await main.evaluate(()=>window.miniallyDesktop.showQuick());await quick.getByRole('textbox',{name:'빠른 메모 본문'}).fill('같은 메모를 빠른 창에서도 수정');await expect(quick.getByRole('status')).toContainText('저장됨');
  await expect(main.getByRole('button',{name:'충돌 사본',exact:false})).toBeVisible();
  const saveBeforeClose=await main.evaluate(async()=>{await window.miniallyDesktop.updatePreferences({autoDownload:false});return await window.miniallyDesktop.getState();});assert.equal(saveBeforeClose.preferences.autoDownload,false);
  assert.equal(await main.evaluate(()=>window.miniallyDesktop.checkUpdate().then(value=>value.kind)),'unsupported');
  await quick.getByRole('button',{name:'새 메모',exact:true}).click();await quick.getByRole('textbox',{name:'빠른 메모 본문'}).fill('아주긴메모'.repeat(200));await expect(quick.getByRole('status')).toContainText('저장됨');await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(win=>win.webContents.getURL().includes('desktop=quick')).setSize(320,600));assert.equal(await quick.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await quick.screenshot({path:path.join(os.tmpdir(),'minially-native-quick.png')});
  await app.context().route('**/api/sync**',route=>route.fulfill({json:{seq:0,records:[]}}));await main.evaluate(()=>localStorage.setItem('minially-sync-v1',JSON.stringify({code:'TESTNATIVE00001',schemaVersion:3,lastSeq:0,shadow:{}})));await expect(quick.getByRole('textbox',{name:'빠른 메모 본문'})).toHaveValue('');await main.evaluate(()=>localStorage.removeItem('minially-sync-v1'));
  console.log('통과: 격리된 렌더러, IPC 입력 검사, 항상 위, 빠른 메모, 두 창 갱신, 충돌 보존, 업데이트 상태');
 }finally{if(app)await app.close();await fs.rm(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exit(1);});
