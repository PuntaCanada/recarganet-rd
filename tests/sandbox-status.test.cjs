const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=fs.readFileSync('functions/api/admin/sandbox-status.js','utf8');
const html=fs.readFileSync('sandbox-status/index.html','utf8');
test('Provider lookup is protected and only allows sandbox',()=>{
 assert.match(api,/RECARGA_TEST_ADMIN_TOKEN/);
 assert.match(api,/RECARGA_D1_DEMO_ENABLED!=='true'/);
 assert.match(api,/rk_sbx_/);
 assert.match(api,/sk_sbx_/);
 assert.match(api,/sandbox!==true/);
});
test('Only GET status is sent to the provider; no D1 modifications or recharges',()=>{
 assert.match(api,/\/v1\/transacciones\//);
 assert.match(api,/\/v1\/cuenta/);
 assert.doesNotMatch(api,/\/v1\/recargas/);
 assert.doesNotMatch(api,/env\.DB\.prepare|Idempotency-Key|method:\s*['"]POST['"]/);
});
test('Provider status is validated and response contains no secret',()=>{
 for(const status of ['SUCCESS','FAILED','PENDING','PROCESSING','REVERSED'])assert.ok(api.includes(status));
 assert.match(api,/UNKNOWN_PROVIDER_STATUS/);
 assert.match(api,/read_only:true/);
 assert.doesNotMatch(api,/secret\s*:\s*secret/);
});
test('Browser form is explicitly read only and parses',()=>{
 assert.match(html,/no modifica pedidos D1/);
 assert.match(html,/\/api\/admin\/sandbox-status/);
 for(const [,js] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(js);
 new vm.Script(api.replaceAll('export async function','async function'));
});
