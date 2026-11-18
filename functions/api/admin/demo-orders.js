// Admin-only synthetic test records in D1. No live orders and no third-party calls.
const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const numbers=new Set(['8095550005','8095550001','8095550002','8095550000']);
const ids={Claro:1,Altice:2,Viva:3};
async function authorized(req,env) {
 const expected=env.RECARGA_TEST_ADMIN_TOKEN;
 const got=req.headers.get('X-Admin-Test-Token');
 if(typeof expected!=='string'||expected.length<32||typeof got!=='string')return false;
 const enc=new TextEncoder();
 const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(expected)),crypto.subtle.digest('SHA-256',enc.encode(got))]);
 const x=new Uint8Array(a),y=new Uint8Array(b);let diff=0;
 for(let i=0;i<x.length;i++)diff|=x[i]^y[i];
 return diff===0;
}
async function check(request,env) {
 if(env.RECARGA_D1_DEMO_ENABLED!=='true'||!env.DB)return response({ok:false,error:'DEMO_DATABASE_DISABLED'},503);
 if(!await authorized(request,env))return response({ok:false,error:'UNAUTHORIZED'},401);
 return null;
}
export async function onRequestGet({request,env}) {
 const denied=await check(request,env);if(denied)return denied;
 try {
  const rows=await env.DB.prepare('SELECT id,operator,amount_dop,test_phone,status,created_at,updated_at FROM demo_orders ORDER BY created_at DESC LIMIT 30').all();
  return response({ok:true,mode:'d1-demo',orders:rows.results||[]});
 }catch{return response({ok:false,error:'DATABASE_NOT_READY'},503)}
}
export async function onRequestPost({request,env}) {
 const denied=await check(request,env);if(denied)return denied;
 if(Number(request.headers.get('content-length')||0)>1024)return response({ok:false,error:'INVALID_INPUT'},413);
 let input;try{input=await request.json()}catch{return response({ok:false,error:'INVALID_JSON'},400)}
 if(!input||typeof input!=='object'||Array.isArray(input))return response({ok:false,error:'INVALID_INPUT'},422);
 const {operator,amount,test_phone}=input;
 if(!Object.hasOwn(ids,operator)||!Number.isInteger(amount)||amount<({Claro:30,Altice:30,Viva:25})[operator]||amount>2000||!numbers.has(test_phone))return response({ok:false,error:'INVALID_INPUT'},422);
 const now=new Date().toISOString(),id='D1-DEMO-'+crypto.randomUUID();
 try {
  await env.DB.prepare('INSERT INTO demo_orders (id,operator,service_id,amount_dop,test_phone,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,operator,ids[operator],amount,test_phone,'created',now,now).run();
  return response({ok:true,mode:'d1-demo',order:{id,operator,amount_dop:amount,test_phone,status:'created',created_at:now}},201);
 }catch{return response({ok:false,error:'DATABASE_NOT_READY'},503)}
}
