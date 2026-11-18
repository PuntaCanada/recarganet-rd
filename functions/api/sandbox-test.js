// Admin-only Recarga.do sandbox scenario runner.
// Never expose as a customer ordering endpoint. Production tokens are rejected.
// Requires RECARGA_SANDBOX_KEY, RECARGA_SANDBOX_SECRET,
// RECARGA_TEST_ADMIN_TOKEN (random private secret, >= 32 characters),
// and RECARGA_SANDBOX_TEST_ENABLED="true" configured in Cloudflare Pages.
const BASE='https://api.recarga.do';
const scenarios=Object.freeze({success:'8095550005',rejected:'8095550001',pending:'8095550002',invalid:'8095550000'});
const headers={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const allowedUUID=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
async function sameSecret(given,actual){
 if(typeof given!=='string'||typeof actual!=='string'||actual.length<32)return false;
 const encoder=new TextEncoder();
 const a=await crypto.subtle.digest('SHA-256',encoder.encode(given));
 const b=await crypto.subtle.digest('SHA-256',encoder.encode(actual));
 const x=new Uint8Array(a),y=new Uint8Array(b);
 let difference=0;for(let i=0;i<x.length;i++)difference|=x[i]^y[i];
 return difference===0;
}
export async function onRequestPost({request,env}){
 if(env.RECARGA_SANDBOX_TEST_ENABLED!=='true')return reply({ok:false,error:'TESTS_DISABLED'},404);
 const key=env.RECARGA_SANDBOX_KEY,secret=env.RECARGA_SANDBOX_SECRET;
 if(typeof key!=='string'||!key.startsWith('rk_sbx_')||typeof secret!=='string'||!secret.startsWith('sk_sbx_'))return reply({ok:false,error:'SANDBOX_ONLY'},503);
 if(!await sameSecret(request.headers.get('X-Admin-Test-Token'),env.RECARGA_TEST_ADMIN_TOKEN))return reply({ok:false,error:'UNAUTHORIZED'},401);
 if(Number(request.headers.get('content-length')||0)>1024)return reply({ok:false,error:'BAD_REQUEST'},413);
 let input;try{input=await request.json()}catch{return reply({ok:false,error:'INVALID_JSON'},400)}
 if(!input||!Object.hasOwn(scenarios,input.scenario)||!allowedUUID(input.idempotency_key))return reply({ok:false,error:'INVALID_TEST_INPUT'},422);
 const auth={Authorization:'Bearer '+key+'.'+secret,Accept:'application/json'};
 let account;
 try{const r=await fetch(BASE+'/v1/cuenta',{headers:auth,signal:AbortSignal.timeout(8000)});if(!r.ok)return reply({ok:false,error:'ACCOUNT_UNAVAILABLE'},503);account=await r.json()}catch{return reply({ok:false,error:'ACCOUNT_UNAVAILABLE'},503)}
 if(account?.data?.sandbox!==true)return reply({ok:false,error:'PRODUCTION_ACCOUNT_BLOCKED'},403);
 const payload={service_id:1,identifier:scenarios[input.scenario],amount:100};
 let response,body;
 try{
 response=await fetch(BASE+'/v1/recargas',{method:'POST',headers:{...auth,'Content-Type':'application/json','Idempotency-Key':input.idempotency_key},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
 body=await response.json();
 }catch{
 return reply({ok:false,mode:'sandbox',state:'unknown',idempotency_key:input.idempotency_key,message:'Unknown outcome. Do NOT retry with a new idempotency key.'},504);
 }
 const state=response.status===201?'success':response.status===202?'pending':response.status===422?'rejected':'unknown';
 return reply({ok:response.status===201||response.status===202||response.status===422,mode:'sandbox',scenario:input.scenario,state,http_status:response.status,transaction_id:body?.data?.transaction_id??body?.data?.id??null,request_id:body?.request_id??response.headers.get('X-Request-Id')??null,error_code:body?.error?.code??null,idempotent_replay:response.headers.get('Idempotent-Replay')==='true',idempotency_key:input.idempotency_key},response.status>=500?502:200);
}
export async function onRequestGet(){return reply({ok:false,error:'METHOD_NOT_ALLOWED'},405)}
