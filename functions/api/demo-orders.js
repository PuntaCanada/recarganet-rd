// This endpoint ONLY creates a synthetic test receipt. It never calls any third-party API.
// No persistent order, personal data, payment or mobile credit is created.
const services = Object.freeze({Claro:1,Altice:2,Viva:3});
const minimum = Object.freeze({Claro:30,Altice:30,Viva:25});
const maximum = 2000;
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
export async function onRequestPost({request}) {
  const length=Number(request.headers.get('content-length')||0);
  if(length>2048) return send({ok:false,error:'INVALID_REQUEST'},413);
  let body;
  try {body=await request.json()}catch{return send({ok:false,error:'INVALID_JSON'},400)}
  if(!body||typeof body!=='object'||Array.isArray(body))return send({ok:false,error:'INVALID_REQUEST'},400);
  const {operator,phone,amount}=body;
  if(typeof operator!=='string'||!Object.prototype.hasOwnProperty.call(services,operator))return send({ok:false,error:'INVALID_OPERATOR'},422);
  if(typeof phone!=='string'||! /^(809|829|849)[0-9]{7}$/.test(phone))return send({ok:false,error:'INVALID_PHONE'},422);
  if(!Number.isInteger(amount)||amount<minimum[operator]||amount>maximum)return send({ok:false,error:'INVALID_AMOUNT'},422);
  const reference='DEMO-'+crypto.randomUUID();
  return send({ok:true,mode:'simulation',reference,service_id:services[operator],operator,phone,amount,currency:'DOP',status:'simulated',created_at:new Date().toISOString(),message:'SIMULATION ONLY. No payment or top-up was made.'},201);
}
export async function onRequestGet(){return send({ok:false,error:'METHOD_NOT_ALLOWED'},405)}
