const fs=require('node:fs/promises'),path=require('node:path');
const {assetPath,apiTarget}=require('./policy.cjs');
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'self'";
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.map':'application/json'};
const reply=(text,status=400)=>Response.json({error:text},{status,headers:{'cache-control':'no-store'}});
async function boundedBody(request,limit=16*1024*1024){if(!request.body)return undefined;const reader=request.body.getReader(),chunks=[];let size=0;try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new RangeError('too large');}chunks.push(Buffer.from(value));}return Buffer.concat(chunks);}finally{reader.releaseLock();}}
function createProtocolHandler({rendererRoot,fetchRemote}){return async request=>{
 let url;try{url=new URL(request.url);}catch{return reply('주소를 확인해 주세요.');}
 if(url.protocol!=='minially:'||url.hostname!=='app'||url.username||url.password||url.port)return reply('허용되지 않는 주소입니다.',403);
 if(url.pathname.startsWith('/api/')){
  const target=apiTarget(request.url);if(!target)return reply('지원하지 않는 요청입니다.',404);
  if(!['GET','POST'].includes(request.method))return reply('지원하지 않는 요청입니다.',405);
  const authorization=request.headers.get('authorization')||'';if(!/^Bearer [A-Z0-9-]{12,128}$/i.test(authorization))return reply('연결 코드를 확인해 주세요.',401);
  try{const body=request.method==='POST'?await boundedBody(request):undefined;const result=await fetchRemote(target,{method:request.method,headers:{authorization,'content-type':'application/json'},body,redirect:'error',signal:AbortSignal.timeout(20000)});if(!(result.headers.get('content-type')||'').includes('application/json'))return reply('서버 응답을 확인하지 못했습니다.',502);return new Response(result.body,{status:result.status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}catch(error){return reply(error instanceof RangeError?'한 번에 보낼 내용이 너무 큽니다.':'서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.',error instanceof RangeError?413:503);}
 }
 if(!['GET','HEAD'].includes(request.method))return reply('지원하지 않는 요청입니다.',405);
 const file=assetPath(rendererRoot,url.pathname);if(!file)return reply('파일을 찾지 못했습니다.',404);
 try{const [base,real]=await Promise.all([fs.realpath(rendererRoot),fs.realpath(file)]);if(!real.startsWith(base+path.sep))return reply('파일을 찾지 못했습니다.',404);const data=await fs.readFile(real);return new Response(request.method==='HEAD'?null:data,{headers:{'content-type':MIME[path.extname(real).toLowerCase()]||'application/octet-stream','content-security-policy':CSP,'x-content-type-options':'nosniff','cache-control':'no-store'}});}catch{return reply('파일을 찾지 못했습니다.',404);}
};}
module.exports={createProtocolHandler,boundedBody,CSP};
