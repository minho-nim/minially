const{randomUUID}=require('node:crypto');
function createCloseGuard(timeout=15000){
 const pending=new Map();
 return{
  async ask(windows){const results=await Promise.all(windows.filter(w=>!w.isDestroyed()&&!w.webContents.isDestroyed()).map(win=>new Promise(resolve=>{if(!win.webContents.getURL()){resolve(true);return;}const id=randomUUID(),timer=setTimeout(()=>{pending.delete(id);resolve(false);},timeout);pending.set(id,{sender:win.webContents.id,finish:value=>{clearTimeout(timer);pending.delete(id);resolve(value);}});try{win.webContents.send('desktop:prepare-close',{id});}catch{pending.get(id)?.finish(false);}})));return results.every(Boolean);},
  acknowledge(sender,payload){if(!payload||typeof payload.id!=='string'||typeof payload.ok!=='boolean')return;const item=pending.get(payload.id);if(item?.sender===sender)item.finish(payload.ok);}
 };
}
module.exports={createCloseGuard};
