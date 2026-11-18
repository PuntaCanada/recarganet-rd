// Private, opt-in D1 ↔ Recarga.do Sandbox association + on-demand reconciliation.
// NO POST to provider, NO customer data, NO automatic top-ups.
const J=(x,s=200)=>Response.json(x,{status:s,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex,nofollow'}});
const statusMap={SUCCESS:'success',FAILED:'rejected',PENDING:'pending',PROCESSING:'pending',REVERSED:'rejected'};
const validOrder=id=>typeof id==='string'&&/^D1-DEMO-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const validUUID=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
async function sameSecret(a,b){
 if(typeof a!=='string'||a.length<32||typeof b!=='string')return false;
 const enc=new TextEncoder();
 const [aa,bb]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(a)),crypto.subtle.digest('SHA-256',enc.encode(b))]);
 const x=new Uint8Array(aa),y=new Uint8Array(bb);let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0;
}
async function getProviderTransaction(env,id){
 const key=env.RECARGA_SANDBOX_KEY,secret=env.RECARGA_SANDBOX_SECRET;
 if(typeof key!=='string'||!key.startsWith('rk_sbx_')||typeof secret!=='string'||!secret.startsWith('sk_sbx_'))
  return {error:'SANDBOX_CREDENTIALS_REQUIRED',http:503};
 const auth={Authorization:'Bearer '+key+'.'+secret,Accept:'application/json'};
 try{
  const acc=await fetch('https://api.recarga.do/v1/cuenta',{headers:auth,signal:AbortSignal.timeout(7000)});
  if(!acc.ok)return {error:'SANDBOX_ACCOUNT_UNAVAILABLE',http:503};
  const account=await acc.json();
  if(account?.data?.sandbox!==true)return {error:'PRODUCTION_ACCOUNT_BLOCKED',http:403};
  const response=await fetch('https://api.recarga.do/v1/transacciones/'+id,{headers:auth,signal:AbortSignal.timeout(8000)});
  if(response.status===404)return {error:'TRANSACTION_NOT_FOUND',http:404};
  if(!response.ok)return {error:'PROVIDER_UNAVAILABLE',http:503};
  const data=await response.json();
  const tx=data?.data?.transaction_id ? data.data : data?.transaction_id ? data : null;
  if(!tx||Number(tx.transaction_id)!==id)return {error:'INVALID_PROVIDER_RESPONSE',http:502};
  const state=String(tx.status??'').toUpperCase();
  if(!Object.hasOwn(statusMap,state))return {error:'UNKNOWN_PROVIDER_STATUS',http:502};
  const serviceId=Number(tx.service?.id),amount=Number(tx.amount);
  // The provider MUST send the full identifier, exact service and exact amount.
  // A masked identifier or a partial match is never enough for linkage.
  if(typeof tx.identifier!=='string'||!/^\d{10}$/.test(tx.identifier)||!Number.isInteger(serviceId)||!Number.isFinite(amount)||tx.currency!=='DOP')
   return {error:'UNVERIFIABLE_PROVIDER_DETAILS',http:502};
  return {tx:{id,status:state,serviceId,identifier:tx.identifier,amount,currency:tx.currency}};
 }catch{return {error:'PROVIDER_TIMEOUT',http:503}}
}
export async function onRequestPost({request,env}){
 if(env.RECARGA_D1_DEMO_ENABLED!=='true'||!env.DB)return J({ok:false,error:'DEMO_DATABASE_DISABLED'},503);
 // Independent feature switch. The earlier POST top-up sandbox switch stays off.
 if(env.RECARGA_LINK_SYNC_ENABLED!=='true')return J({ok:false,error:'LINK_SYNC_DISABLED'},404);
 if(!await sameSecret(env.RECARGA_TEST_ADMIN_TOKEN,request.headers.get('X-Admin-Test-Token')))
  return J({ok:false,error:'UNAUTHORIZED'},401);
 if(Number(request.headers.get('content-length')||0)>1024)return J({ok:false,error:'INVALID_INPUT'},413);
 let input;try{input=await request.json()}catch{return J({ok:false,error:'INVALID_JSON'},400)}
 if(!input||!['link','sync'].includes(input.action)||!validOrder(input.order_id))return J({ok:false,error:'INVALID_INPUT'},422);
 const {order_id}=input;
 try {
  const order=await env.DB.prepare('SELECT id,service_id,operator,amount_dop,test_phone,status FROM demo_orders WHERE id=?').bind(order_id).first();
  if(!order)return J({ok:false,error:'ORDER_NOT_FOUND'},404);
  if(input.action==='link'){
   if(!Number.isSafeInteger(input.transaction_id)||input.transaction_id<=0||!validUUID(input.idempotency_key))
    return J({ok:false,error:'INVALID_LINK_INPUT'},422);
   const existing=await env.DB.prepare('SELECT order_id,transaction_id FROM sandbox_order_links WHERE order_id=? OR transaction_id=? OR idempotency_key=?')
    .bind(order_id,input.transaction_id,input.idempotency_key).first();
   if(existing)return J({ok:false,error:'ALREADY_LINKED'},409);
   const lookup=await getProviderTransaction(env,input.transaction_id);
   if(lookup.error)return J({ok:false,error:lookup.error},lookup.http);
   const tx=lookup.tx;
   if(tx.serviceId!==order.service_id||tx.identifier!==order.test_phone||tx.amount!==order.amount_dop)
    return J({ok:false,error:'TRANSACTION_ORDER_MISMATCH'},409);
   const now=new Date().toISOString();
   try {
    await env.DB.prepare('INSERT INTO sandbox_order_links (order_id,transaction_id,idempotency_key,provider_status,last_checked_at,linked_at) VALUES (?,?,?,?,?,?)')
     .bind(order_id,tx.id,input.idempotency_key,tx.status,now,now).run();
   }catch{return J({ok:false,error:'LINK_CONFLICT_OR_MIGRATION_REQUIRED'},409)}
   return J({ok:true,mode:'sandbox',action:'link',order_id,transaction_id:tx.id,provider_status:tx.status,d1_status:order.status,linked:true,
      note:'Association created; D1 order status was NOT changed. Idempotency key is operator-supplied, not verified by GET transaction.'},201);
  }
  const link=await env.DB.prepare('SELECT order_id,transaction_id,provider_status FROM sandbox_order_links WHERE order_id=?').bind(order_id).first();
  if(!link)return J({ok:false,error:'ORDER_NOT_LINKED'},409);
  const lookup=await getProviderTransaction(env,Number(link.transaction_id));
  if(lookup.error)return J({ok:false,error:lookup.error},lookup.http);
  const tx=lookup.tx;
  if(tx.serviceId!==order.service_id||tx.identifier!==order.test_phone||tx.amount!==order.amount_dop)
   return J({ok:false,error:'TRANSACTION_ORDER_MISMATCH'},409);
  const now=new Date().toISOString(),next=statusMap[tx.status];
  // Keep the update conditional so two admins cannot silently overwrite each other.
  const updated=await env.DB.prepare('UPDATE demo_orders SET status=?,updated_at=? WHERE id=? AND status=? AND EXISTS (SELECT 1 FROM sandbox_order_links WHERE order_id=? AND transaction_id=?)')
   .bind(next,now,order_id,order.status,order_id,tx.id).run();
  if(updated.meta?.changes!==1)return J({ok:false,error:'CONCURRENT_STATUS_CHANGE_RETRY'},409);
  await env.DB.prepare('UPDATE sandbox_order_links SET provider_status=?,last_checked_at=? WHERE order_id=? AND transaction_id=?')
   .bind(tx.status,now,order_id,tx.id).run();
  return J({ok:true,mode:'sandbox',action:'sync',order_id,transaction_id:tx.id,provider_status:tx.status,
    previous_status:order.status,status:next,checked_at:now,source:'Recarga.do Sandbox',no_real_payment:true});
 }catch{return J({ok:false,error:'DATABASE_OR_MIGRATION_NOT_READY'},503)}
}
export async function onRequestGet(){return J({ok:false,error:'METHOD_NOT_ALLOWED'},405)}
