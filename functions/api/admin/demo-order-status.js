// Admin-only manual status changes for fictitious D1 demo records.
// Does NOT call Recarga.do, process money, or assert real fulfillment.
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const statuses=new Set(['created','pending','success','rejected','unknown']);
async function isAuthorized(request,env){
 const expected=env.RECARGA_TEST_ADMIN_TOKEN,provided=request.headers.get('X-Admin-Test-Token');
 if(typeof expected!=='string'||expected.length<32||typeof provided!=='string')return false;
 const enc=new TextEncoder();
 const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(expected)),crypto.subtle.digest('SHA-256',enc.encode(provided))]);
 const x=new Uint8Array(a),y=new Uint8Array(b);let difference=0;
 for(let i=0;i<x.length;i++)difference|=x[i]^y[i];
 return difference===0;
}
export async function onRequestPost({request,env}){
 if(env.RECARGA_D1_DEMO_ENABLED!=='true'||!env.DB)return json({ok:false,error:'DEMO_DATABASE_DISABLED'},503);
 if(!await isAuthorized(request,env))return json({ok:false,error:'UNAUTHORIZED'},401);
 if(Number(request.headers.get('content-length')||0)>1024)return json({ok:false,error:'INVALID_INPUT'},413);
 let input;
 try{input=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
 if(!input||typeof input!=='object'||Array.isArray(input))return json({ok:false,error:'INVALID_INPUT'},422);
 const {reference,status,expected_status}=input;
 if(typeof reference!=='string'||!/^D1-DEMO-[0-9a-f-]{36}$/i.test(reference)||!statuses.has(status)||!statuses.has(expected_status))
  return json({ok:false,error:'INVALID_INPUT'},422);
 if(status===expected_status)return json({ok:false,error:'UNCHANGED_STATUS'},422);
 const updated=new Date().toISOString();
 try{
  const result=await env.DB.prepare('UPDATE demo_orders SET status = ?, updated_at = ? WHERE id = ? AND status = ?')
   .bind(status,updated,reference,expected_status).run();
  if(result.meta?.changes!==1)return json({ok:false,error:'NOT_FOUND_OR_STATUS_CHANGED'},409);
  return json({ok:true,mode:'d1-demo',manual:true,reference,status,previous_status:expected_status,updated_at:updated,
    message:'Manually assigned demonstration status. Not confirmed by mobile provider.'});
 }catch{return json({ok:false,error:'DATABASE_NOT_READY'},503)}
}
export async function onRequestGet(){return json({ok:false,error:'METHOD_NOT_ALLOWED'},405)}
