const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('functions/api/admin/demo-order-status.js','utf8');
const html=fs.readFileSync('demo-orders-admin/index.html','utf8');
test('status updater only operates with private admin token and enabled demo database',()=>{
 assert.match(source,/RECARGA_D1_DEMO_ENABLED!=='true'/);
 assert.match(source,/!env.DB/);
 assert.match(source,/RECARGA_TEST_ADMIN_TOKEN/);
 assert.match(source,/X-Admin-Test-Token/);
});
test('status updates require id and expected previous state',()=>{
 assert.match(source,/expected_status/);
 assert.match(source,/UPDATE demo_orders SET status = \?, updated_at = \? WHERE id = \? AND status = \?/);
 assert.match(source,/result.meta\?\.changes!==1/);
 assert.match(source,/NOT EXISTS \(SELECT 1 FROM sandbox_order_links/);
 assert.match(source,/NOT_FOUND_OR_STATUS_CHANGED/);
});
test('status editor is labeled manual demo only',()=>{
 assert.match(html,/Estado asignado manualmente/);
 assert.match(html,/id="changeStatus"/);
 assert.match(html,/\/api\/admin\/demo-order-status/);
 assert.match(source,/Not confirmed by mobile provider/);
 assert.doesNotMatch(source,/api\.recarga\.do|fetch\(/);
});
test('admin scripts parse without syntax errors',()=>{
 for(const [,js] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(js);
 new vm.Script(source.replaceAll('export async function','async function'));
});
