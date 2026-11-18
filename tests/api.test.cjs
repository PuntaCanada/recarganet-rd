const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('No public recharge or payment function exists',()=>{
  assert.equal(fs.existsSync('functions/api/recargas.js'),false);
  assert.equal(fs.existsSync('functions/api/payments.js'),false);
});
test('Sandbox catalog requires sandbox credentials and verifies account',()=>{
  const source=fs.readFileSync('functions/api/catalog.js','utf8');
  assert.match(source,/rk_sbx_/);
  assert.match(source,/sk_sbx_/);
  assert.match(source,/sandbox\s*!==\s*true/);
  assert.match(source,/\/v1\/cuenta/);
  assert.match(source,/\/v1\/servicios/);
  assert.doesNotMatch(source,/POST\s*\/v1\/recargas/);
});
test('Public API status check is read only',()=>{
  const source=fs.readFileSync('functions/api/status.js','utf8');
  assert.match(source,/\/v1\/estado/);
  assert.doesNotMatch(source,/method:\s*['"]POST['"]/);
});
