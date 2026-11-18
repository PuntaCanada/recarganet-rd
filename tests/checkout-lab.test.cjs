const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const lookup=fs.readFileSync('functions/api/admin/demo-order-lookup.js','utf8');
const checkout=fs.readFileSync('checkout-lab/index.html','utf8');
const created=fs.readFileSync('functions/api/admin/demo-orders.js','utf8');
test('Private persistent lookup requires D1 opt-in and secret admin token',()=>{
 assert.match(lookup,/RECARGA_D1_DEMO_ENABLED!=='true'/);
 assert.match(lookup,/!env.DB/);
 assert.match(lookup,/RECARGA_TEST_ADMIN_TOKEN/);
 assert.match(lookup,/X-Admin-Test-Token/);
 assert.match(lookup,/validReference\(body.reference\)/);
});
test('Lookup is read-only and includes linked provider status only as distinct field',()=>{
 assert.match(lookup,/LEFT JOIN sandbox_order_links/);
 assert.match(lookup,/provider_status:order.provider_status/);
 assert.match(lookup,/sandbox_linked:/);
 assert.match(lookup,/no_real_payment:true/);
 assert.doesNotMatch(lookup,/api\.recarga\.do|fetch\(|INSERT INTO|UPDATE demo_orders/);
});
test('Checkout uses existing synthetic authenticated D1 creation and status lookup',()=>{
 assert.match(checkout,/\/api\/admin\/demo-orders/);
 assert.match(checkout,/\/api\/admin\/demo-order-lookup/);
 assert.match(checkout,/Solo pruebas privadas/);
 assert.match(checkout,/setInterval/);
 assert.match(checkout,/20 segundos/);
 for(const fake of ['8095550005','8095550001','8095550002','8095550000'])assert.ok(checkout.includes(fake));
 assert.doesNotMatch(checkout,/localStorage|sessionStorage|\/api\/sandbox-test|\/v1\/recargas/);
 assert.match(created,/test_phone/);
});
test('Scripts compile',()=>{
 new vm.Script(lookup.replaceAll('export async function','async function'));
 for(const [,script] of checkout.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script);
});
