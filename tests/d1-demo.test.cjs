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
