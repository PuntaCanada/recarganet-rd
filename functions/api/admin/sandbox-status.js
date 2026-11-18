// RecargaNet RD - administrator-only, read-only sandbox transaction status.
// Does not write to D1 and NEVER calls POST /v1/recargas.
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
async function equalSecret(expected,given){
 if(typeof expected!=='string'||expected.length<32||typeof given!=='string')return false;
 const encoder=new TextEncoder();
 const [aa,bb]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(expected)),crypto.subtle.digest('SHA-256',encoder.encode(given))]);
 const a=new Uint8Array(aa),b=new Uint8Array(bb);let diff=0;
 for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 return diff===0;
}
export async function onRequestPost({request,env}){
 // Independent from RECARGA_SANDBOX_TEST_ENABLED, which must remain false.
 if(env.RECARGA_D1_DEMO_ENABLED!=='true')return json({ok:false,error:'DEMO_DISABLED'},404);
 if(!await equalSecret(env.RECARGA_TEST_ADMIN_TOKEN,request.headers.get('X-Admin-Test-Token')))
   return json({ok:false,error:'UNAUTHORIZED'},401);
 const key=env.RECARGA_SANDBOX_KEY,secret=env.RECARGA_SANDBOX_SECRET;
 if(typeof key!=='string'||!key.startsWith('rk_sbx_')||typeof secret!=='string'||!secret.startsWith('sk_sbx_'))
   return json({ok:false,error:'SANDBOX_CREDENTIALS_REQUIRED'},503);
 if(Number(request.headers.get('content-length')||0)>512)return json({ok:false,error:'INVALID_INPUT'},413);
 let body;try{body=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
 const id=body?.transaction_id;
 if(!(typeof id==='number'&&Number.isSafeInteger(id)&&id>0&&id<=999999999999))
   return json({ok:false,error:'INVALID_TRANSACTION_ID'},422);
 const auth={Authorization:'Bearer '+key+'.'+secret,Accept:'application/json'};
 try{
   const accountResponse=await fetch('https://api.recarga.do/v1/cuenta',{headers:auth,signal:AbortSignal.timeout(7000)});
   if(!accountResponse.ok)return json({ok:false,error:'SANDBOX_VERIFICATION_FAILED'},503);
   const account=await accountResponse.json();
   if(account?.data?.sandbox!==true)return json({ok:false,error:'PRODUCTION_ACCOUNT_BLOCKED'},403);
   const result=await fetch('https://api.recarga.do/v1/transacciones/'+id,{headers:auth,signal:AbortSignal.timeout(8000)});
   if(result.status===404)return json({ok:false,mode:'sandbox',error:'TRANSACTION_NOT_FOUND'},404);
   if(!result.ok)return json({ok:false,mode:'sandbox',error:'PROVIDER_UNAVAILABLE',provider_http_status:result.status},503);
   const payload=await result.json();
   const tx=payload?.data?.transaction_id ? payload.data : payload?.transaction_id ? payload : null;
   if(!tx||Number(tx.transaction_id)!==id)return json({ok:false,error:'UNRECOGNIZED_PROVIDER_RESPONSE'},502);
   const status=String(tx.status||'').toUpperCase();
   if(!['SUCCESS','FAILED','PENDING','PROCESSING','REVERSED'].includes(status))
     return json({ok:false,error:'UNKNOWN_PROVIDER_STATUS'},502);
   return json({ok:true,mode:'sandbox',read_only:true,transaction:{
     transaction_id:id,status,service_id:tx.service?.id??null,
     identifier:typeof tx.identifier==='string'?tx.identifier.replace(/.(?=.{4})/g,'*'):null,
     amount:typeof tx.amount==='number'?tx.amount:null,currency:tx.currency??'DOP'
   },request_id:payload?.request_id??result.headers.get('X-Request-Id')??null,
   message:'Sandbox status read only. D1 demo orders are NOT changed.'});
 }catch{return json({ok:false,error:'PROVIDER_TIMEOUT_OR_NETWORK_ERROR'},503)}
}
export async function onRequestGet(){return json({ok:false,error:'METHOD_NOT_ALLOWED'},405)}
