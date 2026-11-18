const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const en=fs.readFileSync('en/index.html','utf8');
const es=fs.readFileSync('index.html','utf8');
const api=fs.readFileSync('functions/api/demo-orders.js','utf8');
test('English page has native English UI and language switch',()=>{
 assert.match(en,/<html lang="en">/);
 assert.match(en,/Top up your phone in seconds/);
 assert.match(en,/href="\/"/);
 assert.match(es,/href="\/en\/"/);
 assert.match(en,/No real payments/);
});
test('Both pages use the isolated server demo order API',()=>{
 for(const s of [en,es]) {
  assert.match(s,/fetch\('\/api\/demo-orders'/);
  assert.match(s,/mode!=='simulation'/);
  for(const [,js] of s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(js);
 }
});
test('Server validates operator, amount and phone and makes only simulation',()=>{
 assert.match(api,/Object\.freeze\(\{Claro:1,Altice:2,Viva:3\}\)/);
 assert.match(api,/Number\.isInteger\(amount\)/);
 assert.match(api,/809\|829\|849/);
 assert.match(api,/crypto\.randomUUID\(\)/);
 assert.match(api,/mode:'simulation'/);
 assert.doesNotMatch(api,/api\.recarga\.do|fetch\(/);
});
