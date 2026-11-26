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

test('Demo body limit applies to actual bytes even without or with false Content-Length',async()=>{
 const source=fs.readFileSync('functions/api/demo-orders.js','utf8');
 const {onRequestPost}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const valid={operator:'Viva',phone:'8095550005',amount:25};
 const invoke=(body,headers={})=>onRequestPost({request:new Request('https://example.invalid/api/demo-orders',{method:'POST',body,headers})});
 const oversized=JSON.stringify({...valid,padding:'é'.repeat(1500)});
 for(const headers of [{},{'content-length':'10'}])assert.equal((await invoke(oversized,headers)).status,413);
 assert.equal((await invoke('{}',{'content-length':'2049'})).status,413);
 const raw=JSON.stringify(valid),exact=raw+' '.repeat(2048-Buffer.byteLength(raw));
 const result=await invoke(exact);assert.equal(result.status,201);assert.equal((await result.json()).mode,'simulation');
 assert.equal((await invoke(exact+' ')).status,413);
 assert.equal((await invoke('{')).status,400);
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(1500));c.enqueue(new Uint8Array(600));c.close()}});
 assert.equal((await onRequestPost({request:new Request('https://example.invalid/api/demo-orders',{method:'POST',body:stream,duplex:'half'})})).status,413);
});
