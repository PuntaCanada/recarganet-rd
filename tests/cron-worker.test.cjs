const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('cron-worker/src/index.js','utf8');
const reconcile=new Function(source.replace('export async function reconcile','async function reconcile').replace('export default {','const scheduledHandler = {')+';return reconcile;')();
function makeDb(state){
 const queries=[];
 const db={prepare(sql){
  const entry={sql,args:[]};queries.push(entry);
  return {bind(...args){entry.args=args;return this},async all(){return {results:state.rows||[]}},async run(){return {meta:{changes:state.changes??1}}}};
 }};
 return {db,queries};
}
const sandbox={data:{sandbox:true}};
const transaction={data:{transaction_id:84630,status:'SUCCESS',service:{id:1},identifier:'8095550005',amount:100,currency:'DOP'}};
const existing={id:'D1-DEMO-00000000-0000-4000-8000-000000000000',status:'pending',service_id:1,amount_dop:100,test_phone:'8095550005',transaction_id:84630,provider_status:'PENDING'};
function env(db,more={}){return {DB:db,RECARGA_CRON_SYNC_ENABLED:'true',RECARGA_SANDBOX_KEY:'rk_sbx_test',RECARGA_SANDBOX_SECRET:'sk_sbx_test',...more}}
async function withProvider(body,fn){
 const before=global.fetch;const urls=[];
 global.fetch=async url=>{urls.push(String(url));return {ok:true,json:async()=>String(url).endsWith('/v1/cuenta')?sandbox:body}};
 try{return await fn(urls)}finally{global.fetch=before}
}
const log={error:()=>{}};
test('scheduled handler exists, HTTP access disabled, and no recharge POST',()=>{
 assert.match(source,/async scheduled\(/);
 assert.match(source,/async fetch\(\)\{return new Response\('Not found'/);
 assert.doesNotMatch(source,/\/v1\/recargas|method:\s*['"]POST['"]/);
});
test('cron disabled without independent opt-in (no provider call)',async()=>{
 const {db,queries}=makeDb({rows:[existing]});
 const got=await reconcile(env(db,{RECARGA_CRON_SYNC_ENABLED:'false'}),log);
 assert.deepEqual(got,{skipped:'disabled'});
 assert.equal(queries.length,0);
});
test('success syncs only matching pending linked orders',async()=>{
 const {db,queries}=makeDb({rows:[existing]});
 await withProvider(transaction,async urls=>{
  const result=await reconcile(env(db),log);
  assert.equal(result.updated,1);
  assert.equal(result.examined,1);
  assert.equal(urls.length,2);
  assert.ok(urls.every(x=>!x.includes('recargas')));
 });
 assert.match(queries[0].sql,/WHERE o.status='pending'/);
 assert.match(queries[0].sql,/l.provider_status IN \('PENDING','PROCESSING'\)/);
 assert.match(queries[1].sql,/AND EXISTS/);
 assert.equal(queries[1].args[0],'success');
});
test('provider mismatch never changes an order',async()=>{
 const {db,queries}=makeDb({rows:[existing]});
 await withProvider({...transaction,data:{...transaction.data,amount:101}},async()=>{
  const result=await reconcile(env(db),log);
  assert.equal(result.invalid,1);assert.equal(result.updated,0);
 });
 assert.equal(queries.length,1);
});
test('pending response changes only last_checked_at',async()=>{
 const {db,queries}=makeDb({rows:[existing]});
 await withProvider({...transaction,data:{...transaction.data,status:'PROCESSING'}},async()=>{
  const result=await reconcile(env(db),log);
  assert.equal(result.still_pending,1);assert.equal(result.updated,0);
 });
 assert.match(queries[1].sql,/UPDATE sandbox_order_links/);
 assert.equal(queries.length,2);
});
test('production account is rejected before reading transaction',async()=>{
 const {db}=makeDb({rows:[existing]});
 const original=global.fetch;let calls=0;
 global.fetch=async()=>{calls++;return {ok:true,json:async()=>({data:{sandbox:false}})}};
 try{await assert.rejects(reconcile(env(db),log),/PRODUCTION_ACCOUNT_BLOCKED/);assert.equal(calls,1)}
 finally{global.fetch=original}
});
