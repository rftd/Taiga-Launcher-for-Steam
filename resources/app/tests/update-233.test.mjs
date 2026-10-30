// 2.3.3: servidor da Cloudflare com banco compartilhado (D1): uma busca serve para todos e o limite das APIs não é atingido.
import test from 'node:test';import assert from 'node:assert/strict';
test('Worker: shared database answers repeated searches, stale data covers upstream limits, only read endpoints', async () => {
 const edge=new Map();globalThis.caches={default:{match:async r=>edge.get(r.url)?.clone(),put:async(r,res)=>{edge.set(r.url,res);}}};
 const rows=new Map();const DB={prepare:sql=>({bind:(...a)=>({first:async()=>{const r=rows.get(a[0]);return r?{...r}:null;},run:async()=>{if(/INSERT/.test(sql))rows.set(a[0],{v:a[1],status:a[2],at:a[3]});return {};}}),run:async()=>({})})};
 let origin=0,fail=false;const realFetch=globalThis.fetch;globalThis.fetch=async url=>{origin++;if(fail)return new Response('limit',{status:429});return new Response(JSON.stringify({success:true,data:[{id:1,name:'Five Nights'}]}),{status:200});};
 const {default:w}=await import('../tools/profile-server/worker.js');const env={SGDB_KEY:'k',DB,CACHE_SAVE_RATE:'1'},ctx={waitUntil:p=>p};
 const get=p=>w.fetch(new Request('https://w.dev'+p),env,ctx);
 let r=await get('/v1/sgdb/search/autocomplete/five');assert.equal(r.status,200);assert.equal(origin,1);
 edge.clear();r=await get('/v1/sgdb/search/autocomplete/five');assert.equal(r.headers.get('x-taiga-cache'),'db');assert.equal(origin,1,'veio do banco');
 for(const k of rows.keys())rows.get(k).at=0;edge.clear();fail=true;r=await get('/v1/sgdb/search/autocomplete/five');assert.equal(r.status,200);assert.equal(r.headers.get('x-taiga-cache'),'db-stale','limite na origem: usa a resposta antiga');
 assert.equal((await get('/v1/sgdb/users/me')).status,400);assert.equal((await w.fetch(new Request('https://w.dev/v1/health'),{},ctx)).status,200);
 globalThis.fetch=realFetch;delete globalThis.caches;
});
