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

test('Every locale has a stable URL and reciprocal search metadata',()=>{
 const routes=['/','/en/','/de/','/fr/','/ht/','/pt/'];
 const languages=['es','en','de','fr','ht','pt'];
 const base='https://recarganet-rd.pages.dev';
 const sitemap=fs.readFileSync('sitemap.xml','utf8');
 for(const route of routes){
  const html=fs.readFileSync('.'+route+'index.html','utf8');
  assert.doesNotMatch(html,/location\.replace\(/);
  assert.ok(html.includes('<link rel="canonical" href="'+base+route+'">'));
  assert.ok(sitemap.includes('<loc>'+base+route+'</loc>'));
  for(const [index,lang] of languages.entries()){
   assert.ok(html.includes('<link rel="alternate" hreflang="'+lang+'" href="'+base+routes[index]+'">'));
  }
 }
});

test('Six-language menu has four locale links with accessible labels',()=>{
 for(const lang of ['es','en','de','fr','ht','pt']){
  const path=lang==='es'?'index.html':lang+'/index.html';
  const html=fs.readFileSync(path,'utf8');
  assert.match(html,new RegExp('<html lang="'+lang+'">'),path);
  assert.match(html,/class="more-languages"/,path);
  for(const link of ['\/de\/','\/fr\/','\/ht\/','\/pt\/'])assert.ok(html.includes('href="'+link+'"'),path+' missing locale '+link);
  assert.match(html,/Aucun paiement réel|Keine echten Zahlungen|Pa gen peman reyèl|Sem pagamentos reais|Sin pagos reales|No real payments/,path+' missing localized warning');
  for(const [,script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(script,{filename:path});
 }
});
