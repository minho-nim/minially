const {contextBridge,ipcRenderer}=require('electron');
const beforeClose=new Set();
const on=(channel,callback)=>{const listener=(_,value)=>callback(value);ipcRenderer.on(channel,listener);return()=>ipcRenderer.removeListener(channel,listener);};
ipcRenderer.on('desktop:prepare-close',async(_,payload)=>{if(!payload||typeof payload.id!=='string')return;let ok=false;try{ok=(await Promise.all([...beforeClose].map(callback=>callback()))).every(value=>value!==false);}catch{}ipcRenderer.send('desktop:close-ready',{id:payload.id,ok});});
contextBridge.exposeInMainWorld('miniallyDesktop',Object.freeze({
 mode:process.argv.includes('--minially-quick')?'quick':'main',
 windowAction:action=>ipcRenderer.invoke('desktop:window',action),
 getState:()=>ipcRenderer.invoke('desktop:state'),
 updatePreferences:patch=>ipcRenderer.invoke('desktop:preferences',patch),
 showMain:()=>ipcRenderer.invoke('desktop:main'),
 showQuick:()=>ipcRenderer.invoke('desktop:quick'),
 hideQuick:()=>ipcRenderer.invoke('desktop:hide-quick'),
 openNote:id=>ipcRenderer.invoke('desktop:open-note',id),
 notifySaved:()=>ipcRenderer.send('desktop:records-changed'),
 checkUpdate:()=>ipcRenderer.invoke('desktop:check-update'),
 downloadUpdate:()=>ipcRenderer.invoke('desktop:download-update'),
 installUpdate:()=>ipcRenderer.invoke('desktop:install-update'),
 onState:callback=>on('desktop:state-changed',callback),
 onOpenNote:callback=>on('desktop:open-note',callback),
 onRefresh:callback=>on('desktop:refresh',callback),
 onQuickFocus:callback=>on('desktop:quick-focus',callback),
 onPrepareClose:callback=>{beforeClose.add(callback);return()=>beforeClose.delete(callback);},
}));
