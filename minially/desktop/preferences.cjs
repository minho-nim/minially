const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {normalizePreferences,preferencePatch}=require('./policy.cjs');
async function createPreferences(root){
 await fs.mkdir(root,{recursive:true,mode:0o700});const target=path.join(root,'desktop-preferences.json');let current;try{current=normalizePreferences(JSON.parse(await fs.readFile(target,'utf8')));}catch{current=normalizePreferences(null);}
 let pending=Promise.resolve();
 return{get:()=>({...current}),update(patch){preferencePatch(patch);const change={...patch};const result=pending.catch(()=>{}).then(async()=>{const next={...current,...change},temp=path.join(root,'preferences-'+randomUUID()+'.tmp');let created=false;try{await fs.writeFile(temp,JSON.stringify(next),{flag:'wx',mode:0o600});created=true;await fs.rename(temp,target);current=next;return{...current};}catch(error){if(created)await fs.unlink(temp).catch(()=>{});throw error;}});pending=result;return result;}};
}
module.exports={createPreferences};
