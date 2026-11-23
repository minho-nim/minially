const path=require('node:path');
const ORIGIN='minially://app';
const API_ORIGIN='https://minially.pages.dev';
const UPDATE_FEED='https://github.com/minho-nim/minially/releases/latest/download/';
const DOWNLOAD_URL=UPDATE_FEED+'Minially-Setup.exe';
const API_PATHS=new Set(['/api/sync','/api/share','/api/shared']);
const DEFAULT_PREFERENCES={alwaysOnTop:false,startOnLogin:false,closeToTray:true,autoDownload:true,zoomFactor:1};
function trustedPage(value){try{const url=new URL(value);return url.protocol==='minially:'&&url.hostname==='app'&&!url.port&&!url.username&&!url.password&&['/','/index.html','/demo'].includes(url.pathname);}catch{return false;}}
function externalURL(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&['minially.pages.dev','github.com','minho-nim.github.io'].includes(url.hostname)&&!url.port?url.href:null;}catch{return null;}}
function assetPath(root,pathname){
 let decoded;try{decoded=decodeURIComponent(pathname);}catch{return null;}
 if(!decoded.startsWith('/')||decoded.includes('\\')||decoded.includes('\0')||decoded.split('/').includes('..'))return null;
 const relative=decoded==='/'||!path.extname(decoded)?'/index.html':decoded;
 if(!/\.(?:html|js|css|json|svg|png|ico|webp|woff2?|txt|map)$/i.test(relative))return null;
 const base=path.resolve(root),resolved=path.resolve(base,'.'+relative);
 return resolved.startsWith(base+path.sep)?resolved:null;
}
function normalizePreferences(input){const value={...DEFAULT_PREFERENCES};if(input&&typeof input==='object')for(const key of Object.keys(value))if(typeof input[key]==='boolean'&&key!=='zoomFactor')value[key]=input[key];if(input&&Number.isFinite(input.zoomFactor)&&input.zoomFactor>=.5&&input.zoomFactor<=1.5)value.zoomFactor=input.zoomFactor;return value;}
function preferencePatch(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!Object.hasOwn(DEFAULT_PREFERENCES,key)||(key==='zoomFactor'?(!Number.isFinite(input[key])||input[key]<.5||input[key]>1.5):typeof input[key]!=='boolean')))throw new Error('설정 값이 올바르지 않습니다.');return input;}
function apiTarget(requestURL){try{const url=new URL(requestURL);if(url.protocol!=='minially:'||url.hostname!=='app'||url.port||url.username||url.password||!API_PATHS.has(url.pathname))return null;return API_ORIGIN+url.pathname+url.search;}catch{return null;}}
module.exports={ORIGIN,API_ORIGIN,UPDATE_FEED,DOWNLOAD_URL,DEFAULT_PREFERENCES,trustedPage,externalURL,assetPath,normalizePreferences,preferencePatch,apiTarget};
