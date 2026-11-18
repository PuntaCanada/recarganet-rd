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

test('Browser language chooses correct landing page, and explicit selection overrides it',()=>{
 function check(page,locale,saved,expected){
  const html=page==='en'?en:es;
  const src=html.match(/<script>\s*\(function\(\)\{\s*const routes=[\s\S]*?<\/script>/)?.[0]?.replace(/^<script>/,'').replace(/<\/script>$/,'');
  assert.ok(src,'Automatic locale routing missing');
  const links=[{lang:'es',events:{},addEventListener(k,fn){this.events[k]=fn}},{lang:'en',events:{},addEventListener(k,fn){this.events[k]=fn}}];
  const storage={v:saved,getItem(){return this.v},setItem(_k,value){this.v=value}};
  const location={pathname:page==='en'?'/en/':'/',search:'',hash:'',replaced:null,replace(url){this.replaced=url}};
  const doc={addEventListener(_k,fn){fn()},querySelectorAll(){return links}};
  vm.runInNewContext(src,{navigator:{languages:[locale],language:locale},localStorage:storage,document:doc,location});
  assert.equal(location.replaced,expected,'Wrong landing page for '+locale+' and '+page);
  links[1].events.click();
  assert.equal(storage.v,'en','Manual English preference was not saved');
 }
 check('es','es-DO',null,null);
 check('es','en-US',null,'/en/');
 check('es','de-DE',null,'/de/');
 check('es','fr-FR',null,'/fr/');
 check('es','ht-HT',null,'/ht/');
 check('es','pt-BR',null,'/pt/');
 check('en','es-DO',null,'/');
 check('en','es-DO','en',null);
 check('es','en-US','es',null);
 check('en','de-DE','en','/de/');
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
