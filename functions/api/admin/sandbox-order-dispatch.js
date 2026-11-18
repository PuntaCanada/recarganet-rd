// Admin-only once-only dispatch of EXISTING fictitious D1 orders to Recarga.do SANDBOX.
// Never send from a public checkout. State is claimed in D1 before any provider POST.
const respond=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex,nofollow'}});
const ORDER_ID=/^D1-DEMO-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SANDBOX_PHONES=new Set(['8095550005','8095550001','8095550002']); // exclude invalid phone
const uuid=()=>crypto.randomUUID();
async function secretEqual(actual,given){
 if(typeof actual!=='string'||actual.length<32||typeof given!=='string')return false;
 const e=new TextEncoder();
 const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',e.encode(actual)),crypto.subtle.digest('SHA-256',e.encode(given))]);
 const x=new Uint8Array(a),y=new Uint8Array(b);let diff=0;
 for(let i=0;i<x.length;i++)diff|=x[i]^y[i];
 return diff===0;
}
const validOrder=o=>o&&o.operator==='Claro'&&o.service_id===1&&o.amount_dop===100&&SANDBOX_PHONES.has(o.test_phone);
const safeId=n=>Number.isSafeInteger(n)&&n>0;
const errorResponse=(code,status)=>respond({ok:false,mode:'sandbox',error:code,no_real_payment:true},status);
async function markUncertain(db,orderId,status,transactionId,requestId){
 await db.prepare("UPDATE sandbox_order_dispatches SET phase='uncertain',response_http_status=?,transaction_id=?,request_id=?,updated_at=? WHERE order_id=? AND phase='sending'")
 .bind(status,transactionId,requestId,new Date().toISOString(),orderId).run();
}
export async function onRequestPost({request,env}){
 if(env.RECARGA_D1_DEMO_ENABLED!=='true'||!env.DB)return errorResponse('DEMO_DATABASE_DISABLED',503);
 if(!await secretEqual(env.RECARGA_TEST_ADMIN_TOKEN,request.headers.get('X-Admin-Test-Token')))return errorResponse('UNAUTHORIZED',401);
 if(Number(request.headers.get('content-length')||0)>512)return errorResponse('INVALID_INPUT',413);
 let input;try{input=await request.json()}catch{return errorResponse('INVALID_JSON',400)}
 const orderId=input?.order_id,action=input?.action;
 if(!ORDER_ID.test(orderId)||!['prepare','send'].includes(action))return errorResponse('INVALID_INPUT',422);
 let order,dispatch,linked;
 try{
  order=await env.DB.prepare('SELECT id,operator,service_id,amount_dop,test_phone,status FROM demo_orders WHERE id=?').bind(orderId).first();
  if(!order)return errorResponse('ORDER_NOT_FOUND',404);
  if(!validOrder(order))return errorResponse('UNSUPPORTED_SANDBOX_SCENARIO',422);
  dispatch=await env.DB.prepare('SELECT order_id,phase,transaction_id,prepared_at,sent_at FROM sandbox_order_dispatches WHERE order_id=?').bind(orderId).first();
  linked=await env.DB.prepare('SELECT transaction_id FROM sandbox_order_links WHERE order_id=?').bind(orderId).first();
 }catch{return errorResponse('MIGRATION_003_NOT_READY',503)}
 if(linked)return errorResponse('ORDER_ALREADY_LINKED',409);
 if(action==='prepare'){
  if(dispatch)return respond({ok:true,mode:'sandbox',action:'prepare',order_id:orderId,phase:dispatch.phase,
   already_prepared:true,transaction_id:dispatch.transaction_id??null,no_real_payment:true});
  if(order.status!=='created')return errorResponse('ORDER_NOT_CREATED',409);
  const now=new Date().toISOString();
  try{
   await env.DB.prepare("INSERT INTO sandbox_order_dispatches (order_id,idempotency_key,phase,prepared_at,updated_at) VALUES (?,?, 'prepared',?,?)")
    .bind(orderId,uuid(),now,now).run();
   return respond({ok:true,mode:'sandbox',action:'prepare',order_id:orderId,phase:'prepared',no_real_payment:true},201);
  }catch{return errorResponse('ALREADY_PREPARED_OR_DATABASE_ERROR',409)}
 }
 // Independent opt-in; the old sandbox scenario runner remains disabled.
 if(env.RECARGA_SANDBOX_ORDER_SEND_ENABLED!=='true')return errorResponse('SANDBOX_ORDER_SEND_DISABLED',404);
 if(!dispatch||dispatch.phase!=='prepared')return errorResponse('ALREADY_SENT_OR_NOT_PREPARED',409);
 if(order.status!=='created')return errorResponse('ORDER_NOT_CREATED',409);
 const key=env.RECARGA_SANDBOX_KEY,secret=env.RECARGA_SANDBOX_SECRET;
 if(typeof key!=='string'||!key.startsWith('rk_sbx_')||typeof secret!=='string'||!secret.startsWith('sk_sbx_'))
  return errorResponse('SANDBOX_CREDENTIALS_REQUIRED',503);
 const auth={Authorization:'Bearer '+key+'.'+secret,Accept:'application/json'};
 try {
  const account=await fetch('https://api.recarga.do/v1/cuenta',{headers:auth,signal:AbortSignal.timeout(7000)});
  if(!account.ok)return errorResponse('SANDBOX_ACCOUNT_UNAVAILABLE',503);
  const body=await account.json();
  if(body?.data?.sandbox!==true)return errorResponse('PRODUCTION_ACCOUNT_BLOCKED',403);
 }catch{return errorResponse('SANDBOX_ACCOUNT_UNAVAILABLE',503)}
 // Atomic conditional D1 claim: after this point no repeat POST is permitted.
 let claim;
 try{
  claim=await env.DB.prepare("UPDATE sandbox_order_dispatches SET phase='sending',sent_at=?,updated_at=? WHERE order_id=? AND phase='prepared' AND EXISTS (SELECT 1 FROM demo_orders WHERE id=? AND status='created')")
   .bind(new Date().toISOString(),new Date().toISOString(),orderId,orderId).run();
 }catch{return errorResponse('DATABASE_NOT_READY',503)}
 if(claim.meta?.changes!==1)return errorResponse('ALREADY_SENT_OR_CHANGED',409);
 let result,data;
 // Fetch key from D1 only after successful claim. Never expose it to the browser.
 try {
  const record=await env.DB.prepare('SELECT idempotency_key FROM sandbox_order_dispatches WHERE order_id=?').bind(orderId).first();
  if(!record?.idempotency_key){await markUncertain(env.DB,orderId,null,null,null);return errorResponse('UNCERTAIN_NO_RETRY',503)}
  result=await fetch('https://api.recarga.do/v1/recargas',{
    method:'POST',headers:{...auth,'Content-Type':'application/json','Idempotency-Key':record.idempotency_key},
    body:JSON.stringify({service_id:1,identifier:order.test_phone,amount:100}),signal:AbortSignal.timeout(12000)
  });
  data=await result.json();
 }catch{
  try{await markUncertain(env.DB,orderId,null,null,null)}catch{}
  return errorResponse('UNCERTAIN_NO_RETRY',504);
 }
 const txid=Number(data?.data?.transaction_id??data?.data?.id);
 const requestId=String(data?.request_id??result.headers.get('X-Request-Id')??'').slice(0,120)||null;
 if(![201,202].includes(result.status)||!safeId(txid)){
  try{await markUncertain(env.DB,orderId,result.status,safeId(txid)?txid:null,requestId)}catch{}
  return respond({ok:false,mode:'sandbox',error:'UNRESOLVED_PROVIDER_RESPONSE_NO_RETRY',
    provider_http_status:result.status,transaction_id:safeId(txid)?txid:null,no_real_payment:true},409);
 }
 // Validate the provider transaction on GET. Never trust only the POST payload for linkage.
 let tx;
 try{
  const check=await fetch('https://api.recarga.do/v1/transacciones/'+txid,{headers:auth,signal:AbortSignal.timeout(8000)});
  if(!check.ok)throw Error('GET failed');
  const payload=await check.json();
  tx=payload?.data?.transaction_id?payload.data:payload?.transaction_id?payload:null;
 }catch{
  try{await markUncertain(env.DB,orderId,result.status,txid,requestId)}catch{}
  return errorResponse('UNCERTAIN_VERIFY_LATER_NO_RETRY',503);
 }
 const s=String(tx?.status||'').toUpperCase();
 if(Number(tx?.transaction_id)!==txid||Number(tx?.service?.id)!==1||
    tx?.identifier!==order.test_phone||Number(tx?.amount)!==100||tx?.currency!=='DOP'||
    !['SUCCESS','FAILED','PENDING','PROCESSING','REVERSED'].includes(s)){
  try{await markUncertain(env.DB,orderId,result.status,txid,requestId)}catch{}
  return errorResponse('PROVIDER_DETAILS_MISMATCH_NO_RETRY',409);
 }
 const now=new Date().toISOString();
 // D1 batch is transactional. Any subsequent error leaves 'sending', never permitting a duplicate POST.
 try {
  const record=await env.DB.prepare('SELECT idempotency_key FROM sandbox_order_dispatches WHERE order_id=? AND phase=?')
   .bind(orderId,'sending').first();
  if(!record?.idempotency_key)return errorResponse('UNCERTAIN_NO_RETRY',409);
  const statements=[
   env.DB.prepare('INSERT INTO sandbox_order_links (order_id,transaction_id,idempotency_key,provider_status,last_checked_at,linked_at) VALUES (?,?,?,?,?,?)')
    .bind(orderId,txid,record.idempotency_key,s,now,now),
   env.DB.prepare("UPDATE demo_orders SET status='pending',updated_at=? WHERE id=? AND status='created'")
    .bind(now,orderId),
   env.DB.prepare("UPDATE sandbox_order_dispatches SET phase='linked',transaction_id=?,response_http_status=?,request_id=?,updated_at=? WHERE order_id=? AND phase='sending'")
    .bind(txid,result.status,requestId,now,orderId)
  ];
  const outcome=await env.DB.batch(statements);
  if(outcome?.[1]?.meta?.changes!==1||outcome?.[2]?.meta?.changes!==1)
   return errorResponse('DATABASE_CONCURRENT_CHANGE_REVIEW',409);
  return respond({ok:true,mode:'sandbox',action:'send',order_id:orderId,
    transaction_id:txid,provider_status:s,status:'pending',idempotent_server_side:true,
    no_real_payment:true,message:'One sandbox POST only. Existing cron reconciles linked pending D1 orders.'},201);
 }catch{
  try{await markUncertain(env.DB,orderId,result.status,txid,requestId)}catch{}
  return errorResponse('DATABASE_LINK_UNCERTAIN_NO_RETRY',503);
 }
}
export async function onRequestGet(){return errorResponse('METHOD_NOT_ALLOWED',405)}
