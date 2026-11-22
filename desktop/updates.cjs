function createUpdates({updater,currentVersion,onChange=()=>{},autoDownload=true}){
 let state={kind:updater?'idle':'unsupported',version:currentVersion,percent:0};
 const emit=patch=>{state={...state,...patch};onChange({...state});};
 const fail=()=>emit({kind:'error',message:'업데이트를 확인하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'});
 if(updater){
  updater.autoDownload=autoDownload;updater.autoInstallOnAppQuit=false;updater.allowDowngrade=false;updater.allowPrerelease=false;
  updater.logger={info(){},warn(){},error(){},debug(){}};
  updater.on('checking-for-update',()=>emit({kind:'checking',message:undefined}));
  updater.on('update-not-available',()=>emit({kind:'current',version:currentVersion,percent:0}));
  updater.on('update-available',info=>emit({kind:'available',version:String(info.version).slice(0,60),percent:0}));
  updater.on('download-progress',info=>emit({kind:'downloading',percent:Math.max(0,Math.min(100,Number(info.percent)||0))}));
  updater.on('update-downloaded',info=>emit({kind:'ready',version:String(info.version).slice(0,60),percent:100}));
  updater.on('error',fail);
 }
 return{
  get:()=>({...state}),
  setAutoDownload(value){if(updater)updater.autoDownload=value;},
  async check(){if(!updater||['checking','downloading','ready','installing'].includes(state.kind))return{...state};try{await updater.checkForUpdates();}catch{fail();}return{...state};},
  async download(){if(!updater||state.kind!=='available')return{...state};emit({kind:'downloading',percent:0});try{await updater.downloadUpdate();}catch{fail();}return{...state};},
  install(){if(!updater||state.kind!=='ready')throw new Error('설치할 업데이트가 준비되지 않았습니다.');emit({kind:'installing'});updater.quitAndInstall(false,true);}
 };
}
module.exports={createUpdates};
