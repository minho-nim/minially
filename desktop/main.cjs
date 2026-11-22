const path=require('node:path');
const {app,BrowserWindow,protocol,session,net,shell,ipcMain}=require('electron');
const {ORIGIN,trustedPage,externalURL,DEFAULT_PREFERENCES}=require('./policy.cjs');
const {createProtocolHandler}=require('./protocol.cjs');
app.setName('Minially');app.setAppUserModelId('com.minially.desktop');
const testMode=!app.isPackaged&&process.env.MINIALLY_DESKTOP_TEST==='1';
if(testMode&&process.env.MINIALLY_DESKTOP_TEST_PROFILE)app.setPath('userData',process.env.MINIALLY_DESKTOP_TEST_PROFILE);
protocol.registerSchemesAsPrivileged([{scheme:'minially',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
let mainWindow;
function authorized(event){return event.senderFrame===event.sender.mainFrame&&trustedPage(event.senderFrame.url);}
function secureWindow(win){
 win.webContents.setWindowOpenHandler(({url})=>{const safe=externalURL(url);if(safe)void shell.openExternal(safe);return{action:'deny'};});
 win.webContents.on('will-navigate',(event,url)=>{if(!trustedPage(url)){event.preventDefault();const safe=externalURL(url);if(safe)void shell.openExternal(safe);}});
 win.webContents.on('will-attach-webview',event=>event.preventDefault());
}
function createMain(){
 if(mainWindow&&!mainWindow.isDestroyed()){mainWindow.show();mainWindow.focus();return mainWindow;}
 mainWindow=new BrowserWindow({width:1280,height:850,minWidth:820,minHeight:600,title:'미니어리',icon:path.join(__dirname,'renderer/pwa-192x192.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,backgroundThrottling:false}});
 secureWindow(mainWindow);mainWindow.setMenuBarVisibility(false);mainWindow.on('closed',()=>{mainWindow=null;});void mainWindow.loadURL(ORIGIN+(testMode?'/demo':'/'));return mainWindow;
}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>createMain());
 app.whenReady().then(()=>{
  session.defaultSession.protocol.handle('minially',createProtocolHandler({rendererRoot:path.join(__dirname,'renderer'),fetchRemote:(...args)=>net.fetch(...args)}));
  session.defaultSession.setPermissionRequestHandler((contents,permission,callback)=>callback(trustedPage(contents.getURL())&&['notifications','clipboard-sanitized-write'].includes(permission)));
  ipcMain.handle('desktop:state',event=>{if(!authorized(event))throw new Error('허용되지 않는 요청입니다.');return{version:app.getVersion(),preferences:{...DEFAULT_PREFERENCES},platform:process.platform};});
  createMain();app.on('activate',()=>createMain());
 });
 app.on('window-all-closed',()=>app.quit());
}
module.exports={authorized};
