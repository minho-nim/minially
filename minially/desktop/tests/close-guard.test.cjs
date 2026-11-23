const test=require('node:test'),assert=require('node:assert/strict');const{createCloseGuard}=require('../close-guard.cjs');
function windowWith(id,send){return{isDestroyed:()=>false,webContents:{id,isDestroyed:()=>false,getURL:()=> 'minially://app/',send}};}
test('모든 창이 저장됐다고 응답해야 닫거나 업데이트할 수 있다',async()=>{const guard=createCloseGuard(30),a=windowWith(1,(_,p)=>guard.acknowledge(1,{...p,ok:true})),b=windowWith(2,(_,p)=>guard.acknowledge(2,{...p,ok:false}));assert.equal(await guard.ask([a]),true);assert.equal(await guard.ask([a,b]),false);});
test('다른 창의 응답이나 응답 없는 창으로 저장 확인을 우회할 수 없다',async()=>{const guard=createCloseGuard(10),win=windowWith(1,(_,p)=>guard.acknowledge(2,{...p,ok:true}));assert.equal(await guard.ask([win]),false);});
