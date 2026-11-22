const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('miniallyDesktop',Object.freeze({
 mode:process.argv.includes('--minially-quick')?'quick':'main',
 getState:()=>ipcRenderer.invoke('desktop:state'),
}));
