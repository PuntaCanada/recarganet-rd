const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=fs.readFileSync('functions/api/admin/demo-orders.js','utf8');
const schema=fs.readFileSync('schema.sql','utf8');
const html=fs.readFileSync('demo-orders-admin/index.html','utf8');
test('D1 orders remain disabled without explicit opt-in and binding',()=>{
 assert.match(api,/RECARGA_D1_DEMO_ENABLED!=='true'/);
 assert.match(api,/!env.DB/);
 assert.match(api,/RECARGA_TEST_ADMIN_TOKEN/);
 assert.match(api,/X-Admin-Test-Token/);
});
test('Demo orders have fixed synthetic phone numbers and controlled statuses',()=>{
 assert.match(api,/8095550005/);
 assert.match(api,/8095550001/);
 assert.match(api,/8095550002/);
 assert.match(api,/8095550000/);
 assert.match(api,/crypto.randomUUID/);
 assert.match(schema,/CREATE TABLE IF NOT EXISTS demo_orders/);
 assert.match(schema,/CHECK \(status IN/);
 assert.match(schema,/test_phone TEXT NOT NULL CHECK/);
 assert.doesNotMatch(api,/api\.recarga\.do|fetch\(/);
});
test('Dashboard sends authorized requests and parses',()=>{
 assert.match(html,/\/api\/admin\/demo-orders/);
 assert.match(html,/Solo demostración/);
 assert.match(html,/textContent=String/);
 for(const [,js] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(js);
 new vm.Script(api.replaceAll('export async function','async function'));
});

test('D1 order handlers execute against the deployed SQLite schema',async()=>{
 const {DatabaseSync}=require('node:sqlite');
 const db=new DatabaseSync(':memory:');
 try{
  for(const path of ['schema.sql','migrations/002_sandbox_links.sql','migrations/003_sandbox_dispatches.sql']){
   db.exec(fs.readFileSync(path,'utf8'));
  }
  const DB={prepare(sql){
   const statement=db.prepare(sql);
   const bind=(...values)=>({
    all:async()=>({results:statement.all(...values)}),
    first:async()=>statement.get(...values),
    run:async()=>({meta:{changes:Number(statement.run(...values).changes)}})
   });
   return {...bind(),bind};
  }};
  const [orders,status,lookup]=await Promise.all(['demo-orders','demo-order-status','demo-order-lookup'].map(async name=>{
   const source=fs.readFileSync('functions/api/admin/'+name+'.js','utf8');
   return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  }));
  const token='synthetic-test-token'.repeat(2);
  const env={DB,RECARGA_D1_DEMO_ENABLED:'true',RECARGA_TEST_ADMIN_TOKEN:token};
  const invoke=(handler,body,provided=token,bindings=env)=>handler({
   env:bindings,
   request:new Request('https://demo.example/api/admin/test',{
    method:body===undefined?'GET':'POST',
    headers:{'X-Admin-Test-Token':provided,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body)
   })
  });
  assert.equal((await invoke(orders.onRequestGet,undefined,'wrong')).status,401);
  assert.equal((await invoke(orders.onRequestGet,undefined,token,{})).status,503);
  const input={operator:'Viva',amount:25,test_phone:'8095550005'};
  assert.equal((await invoke(orders.onRequestPost,{...input,operator:['Viva']})).status,422);
  const created=await invoke(orders.onRequestPost,input);
  assert.equal(created.status,201);
  const {order}=await created.json();
  const listed=await (await invoke(orders.onRequestGet)).json();
  assert.deepEqual(listed.orders.map(row=>row.id),[order.id]);
  const transition={reference:order.id,expected_status:'created',status:'pending'};
  assert.equal((await invoke(status.onRequestPost,transition)).status,200);
  assert.equal((await invoke(status.onRequestPost,transition)).status,409);
  const found=await (await invoke(lookup.onRequestPost,{reference:order.id})).json();
  assert.equal(found.order.status,'pending');
  assert.equal(found.order.sandbox_linked,false);
  db.prepare('INSERT INTO sandbox_order_links VALUES (?, ?, ?, ?, ?, ?)')
   .run(order.id,1,'synthetic-idempotency','PENDING',order.created_at,order.created_at);
  assert.equal((await invoke(status.onRequestPost,{...transition,expected_status:'pending',status:'success'})).status,409);
  const linked=await (await invoke(lookup.onRequestPost,{reference:order.id})).json();
  assert.equal(linked.order.sandbox_linked,true);
  assert.equal(linked.order.provider_status,'PENDING');
 }finally{
  db.close();
 }
});
