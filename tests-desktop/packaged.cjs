const{_electron:electron,expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
 if(process.platform!=='win32'){console.log('Windows 패키지 실행 시험은 Windows 실행기에서 수행합니다.');return;}
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'minially-installed-'));let app;
 try{
  app=await electron.launch({executablePath:path.resolve('desktop-dist/win-unpacked/Minially.exe'),env:{...process.env,APPDATA:profile,LOCALAPPDATA:profile},timeout:45000});
  const main=await app.firstWindow();await expect(main.getByRole('dialog',{name:'연결 코드 입력',exact:true})).toBeVisible();
  await expect(main.getByRole('banner',{name:'앱 창 제목 표시줄'})).toBeVisible();await expect(main.getByRole('button',{name:'앱 버전 및 업데이트 열기'})).toContainText('V.'+require('../desktop/package.json').version);
  const state=await main.evaluate(()=>window.miniallyDesktop.getState());assert.equal(state.version,require('../desktop/package.json').version);assert.equal(state.platform,'win32');assert.notEqual(state.update.kind,'unsupported');assert.equal(await main.evaluate(()=>typeof window.require),'undefined');
  const ready=app.waitForEvent('window');await main.evaluate(()=>window.miniallyDesktop.showQuick());const quick=await ready;await expect(quick.getByRole('dialog',{name:'연결 코드 입력',exact:true})).toBeVisible();assert.equal(await quick.evaluate(()=>window.miniallyDesktop.mode),'quick');
  console.log('통과: 실제 Windows 패키지의 첫 실행, 오프라인 로그인 화면, 업데이트 모듈, 빠른 창, 렌더러 격리');
 }finally{if(app)await app.close();await fs.rm(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exit(1);});
