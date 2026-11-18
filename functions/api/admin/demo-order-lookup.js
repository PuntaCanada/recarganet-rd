// Private, read-only status lookup for a single synthetic D1 order.
// No real customer data, no money flow and no provider calls.
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
const validReference=id=>typeof id==='string'&&/^D1-DEMO-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);
async function isAdmin(request,env){
 const actual=env.RECARGA_TEST_ADMIN_TOKEN,given=request.headers.get('X-Admin-Test-Token');
 if(typeof actual!=='string'||actual.length<32||typeof given!=='string')return false;
 const encoder=new TextEncoder();
 const [aa,bb]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(actual)),crypto.subtle.digest('SHA-256',encoder.encode(given))]);
 const a=new Uint8Array(aa),b=new Uint8Array(bb);let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
 return difference===0;
}
export async function onRequestPost({request,env}){
 if(env.RECARGA_D1_DEMO_ENABLED!=='true'||!env.DB)return reply({ok:false,error:'DEMO_DATABASE_DISABLED'},503);
 if(!await isAdmin(request,env))return reply({ok:false,error:'UNAUTHORIZED'},401);
 if(Number(request.headers.get('content-length')||0)>512)return reply({ok:false,error:'INVALID_INPUT'},413);
 let body;try{body=await request.json()}catch{return reply({ok:false,error:'INVALID_JSON'},400)}
 if(!body||!validReference(body.reference))return reply({ok:false,error:'INVALID_REFERENCE'},422);
 try{
  const order=await env.DB.prepare(
   'SELECT o.id,o.operator,o.service_id,o.amount_dop,o.test_phone,o.status,o.created_at,o.updated_at,'
   +'l.transaction_id,l.provider_status,l.last_checked_at '
   +'FROM demo_orders o LEFT JOIN sandbox_order_links l ON l.order_id=o.id WHERE o.id=?'
  ).bind(body.reference).first();
  if(!order)return reply({ok:false,error:'ORDER_NOT_FOUND'},404);
  return reply({ok:true,mode:'d1-demo',no_real_payment:true,order:{
   reference:order.id,operator:order.operator,service_id:order.service_id,amount_dop:order.amount_dop,
   test_phone:order.test_phone,status:order.status,created_at:order.created_at,updated_at:order.updated_at,
   sandbox_linked:order.transaction_id!==null&&order.transaction_id!==undefined,
   sandbox_transaction_id:order.transaction_id??null,
   provider_status:order.provider_status??null,last_checked_at:order.last_checked_at??null
  },note:'D1 synthetic order status; a manual status is not a provider confirmation.'});
 }catch{return reply({ok:false,error:'DATABASE_NOT_READY'},503)}
}
export async function onRequestGet(){return reply({ok:false,error:'METHOD_NOT_ALLOWED'},405)}
