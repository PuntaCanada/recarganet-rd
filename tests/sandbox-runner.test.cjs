const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('functions/api/sandbox-test.js','utf8');
test('Sandbox runner is disabled by default and requires private admin token',()=>{
 assert.match(source,/RECARGA_SANDBOX_TEST_ENABLED/);
 assert.match(source,/RECARGA_TEST_ADMIN_TOKEN/);
 assert.match(source,/sameSecret/);
 assert.match(source,/rk_sbx_/);
 assert.match(source,/sk_sbx_/);
 assert.match(source,/sandbox\s*!==\s*true/);
});
test('Only fixed test numbers and one safe service and amount',()=>{
 for(const suffix of ['0005','0001','0002','0000'])assert.match(source,new RegExp('809555'+suffix));
 assert.match(source,/service_id:1,identifier:scenarios\[input\.scenario\],amount:100/);
 assert.match(source,/Idempotency-Key/);
 assert.match(source,/allowedUUID\(input\.idempotency_key\)/);
 assert.doesNotMatch(source,/RECARGA_PRODUCTION/);
});
test('Pending and uncertain states do not automatically retry with a new key',()=>{
 assert.match(source,/response\.status===202\?'pending'/);
 assert.match(source,/state:'unknown'/);
 assert.doesNotMatch(source,/for\s*\(/);
});
test('Cloudflare function parses as an ES module',()=>{
 new vm.Script(source.replaceAll('export async function','async function'));
});
