const path=require('node:path');
const {app,BrowserWindow,protocol,session,net,shell,ipcMain,Tray,Menu,nativeImage,globalShortcut,dialog,screen}=require('electron');
const {ORIGIN,trustedPage,externalURL,preferencePatch,UPDATE_FEED}=require('./policy.cjs');
const {createProtocolHandler}=require('./protocol.cjs');
const {createPreferences}=require('./preferences.cjs');
const {createUpdates}=require('./updates.cjs');
const {createCloseGuard}=require('./close-guard.cjs');
app.setName('Minially');app.setAppUserModelId('com.minially.desktop');
const testMode=!app.isPackaged&&process.env.MINIALLY_DESKTOP_TEST==='1';
if(testMode&&process.env.MINIALLY_DESKTOP_TEST_PROFILE)app.setPath('userData',process.env.MINIALLY_DESKTOP_TEST_PROFILE);
protocol.registerSchemesAsPrivileged([{scheme:'minially',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
const closeGuard=createCloseGuard(),shortcut='Control+Alt+M';
let mainWindow,quickWindow,tray,preferences,updates,shortcutAvailable=false,quitAllowed=false,quitPending=false;
const windows=()=>BrowserWindow.getAllWindows().filter(win=>!win.isDestroyed());
const broadcast=(channel,value,except)=>{for(const win of windows())if(win.webContents.id!==except)win.webContents.send(channel,value);};
const state=(win=mainWindow)=>({window:{maximized:!!win&&!win.isDestroyed()&&win.isMaximized(),focused:!!win&&!win.isDestroyed()&&win.isFocused()},version:app.getVersion(),platform:process.platform,preferences:preferences.get(),update:updates.get(),shortcut,shortcutAvailable,canStartOnLogin:process.platform==='win32'});
const publishState=()=>{if(preferences&&updates)for(const win of windows())win.webContents.send('desktop:state-changed',state(win));};
function authorized(event){return event.senderFrame===event.sender.mainFrame&&trustedPage(event.senderFrame.url);}
function secureWindow(win){
 win.on('page-title-updated',event=>event.preventDefault());
 for(const event of ['focus','blur','maximize','unmaximize','restore','enter-full-screen','leave-full-screen'])win.on(event,publishState);
 win.webContents.setWindowOpenHandler(({url})=>{const safe=externalURL(url);if(safe)void shell.openExternal(safe);return{action:'deny'};});
 win.webContents.on('will-navigate',(event,url)=>{if(!trustedPage(url)){event.preventDefault();const safe=externalURL(url);if(safe)void shell.openExternal(safe);}});
 win.webContents.on('will-attach-webview',event=>event.preventDefault());
 win.setMenuBarVisibility(false);
}
function webPreferences(quick=false){return{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,backgroundThrottling:false,additionalArguments:quick?['--minially-quick']:[]};}
function createMain(){
 if(mainWindow&&!mainWindow.isDestroyed()){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();return mainWindow;}
 mainWindow=new BrowserWindow({frame:false,roundedCorners:true,backgroundColor:'#FFF8FA',width:1280,height:850,minWidth:820,minHeight:600,title:`미니어리 V.${app.getVersion()}`,icon:path.join(__dirname,'renderer/pwa-192x192.png'),alwaysOnTop:preferences.get().alwaysOnTop,webPreferences:webPreferences()});
 secureWindow(mainWindow);mainWindow.on('close',event=>{if(quitAllowed)return;event.preventDefault();if(preferences.get().closeToTray&&tray)mainWindow.hide();else void finishApp(false);});mainWindow.on('closed',()=>{mainWindow=null;});void mainWindow.loadURL(ORIGIN+(testMode?'/demo':'/'));return mainWindow;
}
function createQuick(){
 if(quickWindow&&!quickWindow.isDestroyed()){if(quickWindow.isMinimized())quickWindow.restore();quickWindow.show();quickWindow.focus();quickWindow.webContents.send('desktop:quick-focus');return;}
 const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea,width=Math.min(460,area.width),height=Math.min(600,area.height);
 quickWindow=new BrowserWindow({frame:false,roundedCorners:true,backgroundColor:'#FFF8FA',width,height,minWidth:320,minHeight:360,x:Math.max(area.x,area.x+area.width-width-24),y:Math.max(area.y,area.y+40),title:`빠른 메모 · 미니어리 V.${app.getVersion()}`,icon:path.join(__dirname,'renderer/pwa-192x192.png'),alwaysOnTop:preferences.get().alwaysOnTop,webPreferences:webPreferences(true)});
 secureWindow(quickWindow);quickWindow.on('close',event=>{if(quitAllowed)return;event.preventDefault();void closeGuard.ask([quickWindow]).then(ok=>{if(ok)quickWindow?.hide();});});quickWindow.on('closed',()=>{quickWindow=null;});void quickWindow.loadURL(ORIGIN+'/?desktop=quick');
}
async function finishApp(install){
 if(quitPending)return;quitPending=true;
 try{if(install&&updates.get().kind!=='ready')throw new Error('업데이트가 아직 준비되지 않았습니다.');if(!await closeGuard.ask(windows()))throw new Error('저장하지 못한 내용이나 열린 편집창이 있습니다. 내용을 확인한 뒤 다시 시도해 주세요.');quitAllowed=true;if(install)updates.install();else app.quit();}
 catch(error){quitAllowed=false;if(install)throw new Error('열린 편집창과 메모 저장 상태를 확인한 뒤 다시 시도해 주세요.');const owner=mainWindow||quickWindow;if(owner){owner.show();owner.focus();}await dialog.showMessageBox(owner,{type:'warning',title:'미니어리',message:'아직 종료하지 않았습니다.',detail:'열린 편집창과 메모 저장 상태를 확인한 뒤 다시 시도해 주세요.',buttons:['확인']});}
 finally{quitPending=false;}
}
function trayMenu(){if(!tray)return;tray.setContextMenu(Menu.buildFromTemplate([{label:'미니어리 열기',click:()=>createMain()},{label:'빠른 메모  Ctrl+Alt+M',click:()=>createQuick()},{type:'separator'},{label:'항상 위',type:'checkbox',checked:preferences.get().alwaysOnTop,click:item=>{void changePreferences({alwaysOnTop:item.checked}).catch(()=>{});}},{type:'separator'},{label:'종료',click:()=>{void finishApp(false);}}]));}
async function changePreferences(input){
 const patch=preferencePatch(input);if(Object.hasOwn(patch,'startOnLogin')&&process.platform!=='win32')throw new Error('로그인 시 실행은 Windows에서 설정할 수 있습니다.');
 const previous=preferences.get(),next=await preferences.update(patch);
 try{if(Object.hasOwn(patch,'startOnLogin'))app.setLoginItemSettings({openAtLogin:next.startOnLogin});for(const win of windows())win.setAlwaysOnTop(next.alwaysOnTop);updates.setAutoDownload(next.autoDownload);trayMenu();publishState();return state();}
 catch{await preferences.update(previous);publishState();throw new Error('앱 설정을 적용하지 못했습니다. 다시 시도해 주세요.');}
}
function registerIPC(){
 const handle=(name,fn)=>ipcMain.handle(name,async(event,...args)=>{if(!authorized(event))throw new Error('허용되지 않는 요청입니다.');return fn(event,...args);});
 handle('desktop:state',event=>state(BrowserWindow.fromWebContents(event.sender)));handle('desktop:preferences',async(event,patch)=>{await changePreferences(patch);return state(BrowserWindow.fromWebContents(event.sender));});handle('desktop:main',()=>{createMain();});handle('desktop:quick',()=>{createQuick();});
 handle('desktop:window',(event,action)=>{
  if(!['minimize','maximize','close'].includes(action))throw new Error('지원하지 않는 창 동작입니다.');
  const win=BrowserWindow.fromWebContents(event.sender);if(!win||win.isDestroyed())return;
  if(action==='minimize')win.minimize();
  else if(action==='maximize'){if(win.isFullScreen())win.setFullScreen(false);else if(win.isMaximized())win.unmaximize();else win.maximize();}
  else win.close();
 });
 handle('desktop:hide-quick',async()=>{if(quickWindow&&await closeGuard.ask([quickWindow]))quickWindow.hide();});
 handle('desktop:open-note',(_,id)=>{if(typeof id!=='string'||!id||id.length>200)throw new Error('메모를 확인해 주세요.');const win=createMain(),send=()=>win.webContents.send('desktop:open-note',id);if(win.webContents.isLoadingMainFrame())win.webContents.once('did-finish-load',send);else send();});
 handle('desktop:check-update',()=>updates.check());handle('desktop:download-update',()=>updates.download());handle('desktop:install-update',()=>finishApp(true));
 ipcMain.on('desktop:records-changed',event=>{if(authorized(event))broadcast('desktop:refresh',undefined,event.sender.id);});
 ipcMain.on('desktop:close-ready',(event,payload)=>{if(authorized(event))closeGuard.acknowledge(event.sender.id,payload);});
}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',(_,argv)=>{if(argv.includes('--quick-note'))createQuick();else createMain();});
 app.whenReady().then(async()=>{
  preferences=await createPreferences(app.getPath('userData'));
  session.defaultSession.protocol.handle('minially',createProtocolHandler({rendererRoot:path.join(__dirname,'renderer'),fetchRemote:(...args)=>net.fetch(...args)}));
  session.defaultSession.setPermissionRequestHandler((contents,permission,callback)=>callback(trustedPage(contents.getURL())&&['notifications','clipboard-sanitized-write'].includes(permission)));
  let updater=null;if(app.isPackaged&&process.platform==='win32'){updater=require('electron-updater').autoUpdater;updater.setFeedURL({provider:'generic',url:UPDATE_FEED});}
  updates=createUpdates({updater,currentVersion:app.getVersion(),autoDownload:preferences.get().autoDownload,onChange:publishState});registerIPC();
  if(!testMode){try{tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'renderer/pwa-192x192.png')).resize({width:20,height:20}));tray.setToolTip('미니어리');tray.on('double-click',()=>createMain());trayMenu();}catch{tray=null;}shortcutAvailable=globalShortcut.register(shortcut,createQuick);}
  createMain();if(process.argv.includes('--quick-note'))createQuick();
  if(updater){setTimeout(()=>{void updates.check();},10000).unref();setInterval(()=>{void updates.check();},4*60*60*1000).unref();}
  app.on('activate',()=>createMain());
 }).catch(()=>{dialog.showErrorBox('미니어리','앱을 시작하지 못했습니다. 저장 공간과 설치 상태를 확인한 뒤 다시 열어 주세요.');quitAllowed=true;app.quit();});
 app.on('before-quit',event=>{if(!quitAllowed){event.preventDefault();void finishApp(false);}});
 app.on('will-quit',()=>globalShortcut.unregisterAll());
 app.on('window-all-closed',()=>{if(!quitAllowed)void finishApp(false);});
}
