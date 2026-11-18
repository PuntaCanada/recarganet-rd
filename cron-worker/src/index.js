// RecargaNet RD — independent Cloudflare Cron Worker.
// Sandbox-only reconciliation of EXISTING linked D1 test orders.
// No public HTTP API, no new recargas, no payments or real phone numbers.
const PROVIDER='https://api.recarga.do';
const ELIGIBLE=new Set(['PENDING','PROCESSING']);
const STATES={SUCCESS:'success',FAILED:'rejected',PENDING:'pending',PROCESSING:'pending',REVERSED:'rejected'};
const MAX_PER_RUN=5;
async function providerGet(url,auth){
 const response=await fetch(url,{headers:auth,signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error('Provider HTTP '+response.status);
 return response.json();
}
function parseTransaction(payload,expectedId){
 const data=payload?.data?.transaction_id?payload.data:payload?.transaction_id?payload:null;
 if(!data||Number(data.transaction_id)!==expectedId)throw new Error('Transaction ID mismatch');
 const state=String(data.status||'').toUpperCase();
 if(!Object.hasOwn(STATES,state))throw new Error('Unexpected provider status');
 const service=Number(data.service?.id),amount=Number(data.amount);
 if(!Number.isInteger(service)||!Number.isFinite(amount)||data.currency!=='DOP'||
    typeof data.identifier!=='string'||!/^\d{10}$/.test(data.identifier))
  throw new Error('Unverifiable provider details');
 return {state,service,amount,identifier:data.identifier};
}
export async function reconcile(env,log=console){
 if(env.RECARGA_CRON_SYNC_ENABLED!=='true')return {skipped:'disabled'};
 if(!env.DB)throw new Error('Missing D1 DB binding');
 const key=env.RECARGA_SANDBOX_KEY,secret=env.RECARGA_SANDBOX_SECRET;
 if(typeof key!=='string'||!key.startsWith('rk_sbx_')||typeof secret!=='string'||!secret.startsWith('sk_sbx_'))
  throw new Error('Sandbox-only credentials required');
 const auth={Authorization:'Bearer '+key+'.'+secret,Accept:'application/json'};
 const account=await providerGet(PROVIDER+'/v1/cuenta',auth);
 if(account?.data?.sandbox!==true)throw new Error('PRODUCTION_ACCOUNT_BLOCKED');
 const rows=await env.DB.prepare(
  "SELECT o.id,o.status,o.service_id,o.amount_dop,o.test_phone,l.transaction_id,l.provider_status "+
  "FROM sandbox_order_links l JOIN demo_orders o ON o.id=l.order_id "+
  "WHERE o.status='pending' AND l.provider_status IN ('PENDING','PROCESSING') "+
  "ORDER BY l.last_checked_at ASC LIMIT ?"
 ).bind(MAX_PER_RUN).all();
 const results={examined:0,updated:0,still_pending:0,invalid:0,errors:0};
 for(const order of rows.results||[]){
  results.examined++;
  try{
   const payload=await providerGet(PROVIDER+'/v1/transacciones/'+Number(order.transaction_id),auth);
   const tx=parseTransaction(payload,Number(order.transaction_id));
   if(tx.service!==order.service_id||tx.amount!==order.amount_dop||tx.identifier!==order.test_phone){
    results.invalid++;log.error('sandbox-cron mismatch',order.id);continue;
   }
   const now=new Date().toISOString();
   if(ELIGIBLE.has(tx.state)){
    await env.DB.prepare(
     'UPDATE sandbox_order_links SET provider_status=?,last_checked_at=? WHERE order_id=? AND transaction_id=? AND provider_status IN (?,?)'
    ).bind(tx.state,now,order.id,order.transaction_id,'PENDING','PROCESSING').run();
    results.still_pending++;continue;
   }
   // Do not overwrite a manually edited or already-terminal D1 record.
   const updated=await env.DB.prepare(
    "UPDATE demo_orders SET status=?,updated_at=? WHERE id=? AND status='pending' "+
    "AND EXISTS (SELECT 1 FROM sandbox_order_links WHERE order_id=? AND transaction_id=? AND provider_status IN ('PENDING','PROCESSING'))"
   ).bind(STATES[tx.state],now,order.id,order.id,order.transaction_id).run();
   if(updated.meta?.changes!==1){results.errors++;continue}
   await env.DB.prepare(
    'UPDATE sandbox_order_links SET provider_status=?,last_checked_at=? WHERE order_id=? AND transaction_id=?'
   ).bind(tx.state,now,order.id,order.transaction_id).run();
   results.updated++;
  }catch(error){
   results.errors++;
   // No credentials or customer details in logs.
   log.error('sandbox-cron check failed',order.id,String(error.message||error));
  }
 }
 return results;
}
export default {
 async scheduled(controller,env,ctx){
  ctx.waitUntil(reconcile(env).then(result=>console.log('sandbox-cron summary',JSON.stringify(result)))
   .catch(error=>console.error('sandbox-cron fatal',String(error.message||error))));
 },
 async fetch(){return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}})}
};
