const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=fs.readFileSync('functions/api/admin/sandbox-order-dispatch.js','utf8');
const sql=fs.readFileSync('migrations/003_sandbox_dispatches.sql','utf8');
const page=fs.readFileSync('sandbox-dispatch-admin/index.html','utf8');
const moduleCode=api.replaceAll('export async function','async function');
const handler=new Function(moduleCode+';return onRequestPost;')();
const orderId='D1-DEMO-6634d20a-066b-4060-a5d5-6f30055b313b';
const createRequest=(action,order_id=orderId)=>new Request('https://example.invalid/api/admin/sandbox-order-dispatch',
 {method:'POST',headers:{'Content-Type':'application/json','X-Admin-Test-Token':'x'.repeat(40)},body:JSON.stringify({action,order_id})});
test('Migration stores a server-side unique idempotency key and one claim per order',()=>{
 assert.match(sql,/CREATE TABLE IF NOT EXISTS sandbox_order_dispatches/);
 assert.match(sql,/order_id TEXT PRIMARY KEY/);
 assert.match(sql,/idempotency_key TEXT NOT NULL UNIQUE/);
 assert.match(sql,/prepared','sending','linked','uncertain'/);
 assert.match(sql,/transaction_id INTEGER UNIQUE/);
});
test('Only a private, separately opted-in sandbox can send',()=>{
 assert.match(api,/RECARGA_D1_DEMO_ENABLED!=='true'/);
 assert.match(api,/RECARGA_TEST_ADMIN_TOKEN/);
 assert.match(api,/RECARGA_SANDBOX_ORDER_SEND_ENABLED!=='true'/);
 assert.match(api,/rk_sbx_/);
 assert.match(api,/sk_sbx_/);
 assert.match(api,/sandbox!==true/);
 assert.match(api,/SANDBOX_PHONES/);
 assert.match(api,/order.operator==='Claro'/);
 assert.match(api,/o.amount_dop===100/);
});
test('Persist key before single provider POST; conditional claim blocks repetition',()=>{
 const insert=api.indexOf('INSERT INTO sandbox_order_dispatches');
 const claim=api.indexOf("SET phase='sending'");
 const post=api.indexOf("fetch('https://api.recarga.do/v1/recargas'");
 assert.ok(insert>=0&&claim>insert&&post>claim);
 assert.match(api,/phase='prepared'/);
 assert.match(api,/claim.meta\?\.changes!==1/);
 assert.match(api,/ALREADY_SENT_OR_NOT_PREPARED/);
 assert.match(api,/UNCERTAIN_NO_RETRY/);
 assert.match(api,/Idempotency-Key':record.idempotency_key/);
 assert.doesNotMatch(api,/crypto\.randomUUID\(\).*fetch\('https:\/\/api\.recarga\.do\/v1\/recargas'/);
});
test('Post transaction is independently verified before atomic linked D1 state',()=>{
 assert.match(api,/\/v1\/transacciones\//);
 assert.match(api,/tx\?\.identifier!==order.test_phone/);
 assert.match(api,/tx\?\.currency!=='DOP'/);
 assert.match(api,/await env.DB.batch\(statements\)/);
 assert.match(api,/UPDATE demo_orders SET status='pending'/);
 assert.match(api,/INSERT INTO sandbox_order_links/);
 assert.doesNotMatch(api,/Idempotency-Key.*return respond/);
});
test('Private UI requires explicit prepare, shows no key and scripts compile',()=>{
 assert.match(page,/Solo administrador/);
 assert.match(page,/confirm\(/);
 assert.match(page,/id="send" type="button" disabled/);
 assert.match(page,/\/api\/admin\/sandbox-order-dispatch/);
 assert.doesNotMatch(page,/localStorage|sessionStorage|\/v1\/recargas/);
 new vm.Script(moduleCode);
 for(const [,code] of page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(code);
});
test('Dispatch disabled yields no D1 or provider call',async()=>{
 const out=await handler({request:createRequest('send'),env:{RECARGA_D1_DEMO_ENABLED:'false'}});
 assert.equal(out.status,503);
 assert.equal((await out.json()).error,'DEMO_DATABASE_DISABLED');
});
test('Admin check fails closed before D1 queries',async()=>{
 let reads=0;
 const db={prepare(){reads++;throw Error('should not query D1')}};
 const out=await handler({request:createRequest('send'),env:{RECARGA_D1_DEMO_ENABLED:'true',DB:db,RECARGA_TEST_ADMIN_TOKEN:'different-secret-long-enough-123456'}});
 assert.equal(out.status,401);assert.equal(reads,0);
});
