const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=fs.readFileSync('functions/api/admin/sandbox-order-link.js','utf8');
const manual=fs.readFileSync('functions/api/admin/demo-order-status.js','utf8');
const sql=fs.readFileSync('migrations/002_sandbox_links.sql','utf8');
const html=fs.readFileSync('sandbox-link-admin/index.html','utf8');

test('D1 migration links each transaction to at most one order',()=>{
 assert.match(sql,/CREATE TABLE IF NOT EXISTS sandbox_order_links/);
 assert.match(sql,/order_id TEXT PRIMARY KEY/);
 assert.match(sql,/transaction_id INTEGER NOT NULL UNIQUE/);
 assert.match(sql,/idempotency_key TEXT NOT NULL UNIQUE/);
});
test('linking requires sandbox, admin token, explicit opt-in, full matching provider details',()=>{
 assert.match(api,/RECARGA_LINK_SYNC_ENABLED!=='true'/);
 assert.match(api,/RECARGA_D1_DEMO_ENABLED!=='true'/);
 assert.match(api,/RECARGA_TEST_ADMIN_TOKEN/);
 assert.match(api,/sandbox!==true/);
 assert.match(api,/tx.serviceId!==order.service_id\|\|tx.identifier!==order.test_phone\|\|tx.amount!==order.amount_dop/);
 assert.match(api,/TRANSACTION_ORDER_MISMATCH/);
 assert.match(api,/ALREADY_LINKED/);
});
test('reconciliation is read-only against provider and guarded in D1',()=>{
 assert.match(api,/\/v1\/transacciones\//);
 assert.doesNotMatch(api,/\/v1\/recargas|method:\s*['"]POST['"]/);
 assert.match(api,/AND status=\? AND EXISTS/);
 assert.match(api,/CONCURRENT_STATUS_CHANGE_RETRY/);
 assert.match(manual,/NOT EXISTS \(SELECT 1 FROM sandbox_order_links/);
});
test('pending and processing map to pending and no unrecognized statuses are trusted',()=>{
 assert.match(api,/PENDING:'pending'/);
 assert.match(api,/PROCESSING:'pending'/);
 assert.match(api,/UNKNOWN_PROVIDER_STATUS/);
 assert.match(api,/UNVERIFIABLE_PROVIDER_DETAILS/);
});
test('admin browser scripts and server function compile',()=>{
 for(const [,script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script);
 new vm.Script(api.replaceAll('export async function','async function'));
});
