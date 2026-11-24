const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
test('Three mobile services are matched by ID, not arbitrary catalog entries',()=>{
 assert.match(html,/Claro:1,Altice:2,Viva:3/);
 assert.match(html,/x\.id===serviceIds\[name\]/);
 assert.match(html,/x\.name/);
});
test('Sandbox limits and custom amount validation are present',()=>{
 assert.match(html,/fetch\('\/api\/catalog'/);
 assert.match(html,/id="customAmount"/);
 assert.match(html,/amount>=Math\.max\(demoMinimum\[operator\],l\?\.min\?\?0\)&&amount<=Math\.min\(2000,l\?\.max\?\?2000\)/);
 assert.match(html,/if\(!validAmount\(\)\)/);
});
