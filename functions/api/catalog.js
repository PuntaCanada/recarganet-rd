// Endpoint de SOLO LECTURA. Nunca realiza recargas ni pagos.
// Configurar RECARGA_SANDBOX_KEY y RECARGA_SANDBOX_SECRET como secretos de Cloudflare Pages.
const BASE = 'https://api.recarga.do';
const headers = {'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
const reply = (data,status=200)=> new Response(JSON.stringify(data),{status,headers});
export async function onRequestGet({env}) {
  const key=env.RECARGA_SANDBOX_KEY, secret=env.RECARGA_SANDBOX_SECRET;
  if (!key || !secret || !key.startsWith('rk_sbx_') || !secret.startsWith('sk_sbx_')) {
    return reply({enabled:false,mode:'demo',message:'Catálogo sandbox pendiente de configurar; no se permiten claves de producción.'});
  }
  const auth={Authorization:'Bearer '+key+'.'+secret, Accept:'application/json'};
  try {
    const account=await fetch(BASE+'/v1/cuenta',{headers:auth,signal:AbortSignal.timeout(6500)});
    if (!account.ok) return reply({enabled:false,message:'No se pudo verificar el ambiente de pruebas.'},503);
    const accountData=await account.json();
    if (accountData?.data?.sandbox!==true) return reply({enabled:false,message:'Cuenta no confirmada como sandbox. Operación bloqueada.'},403);
    const response=await fetch(BASE+'/v1/servicios',{headers:auth,signal:AbortSignal.timeout(6500)});
    if (!response.ok) return reply({enabled:false,message:'No se pudo obtener el catálogo de pruebas.'},503);
    const payload=await response.json();
    // La API devuelve datos de catálogo; nunca devolvemos tokens ni información de cuenta.
    const services=Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.data?.services) ? payload.data.services : Array.isArray(payload?.data?.servicios) ? payload.data.servicios : null;
    if (!services) return reply({enabled:false,message:'Formato de catálogo aún no compatible.'},502);
    return reply({enabled:true,mode:'sandbox',count:services.length,services:services.map(s=>({
      id:s.id ?? s.service_id ?? null, name:String(s.nombre ?? s.name ?? '').slice(0,120),
      min:s.monto_minimo ?? s.min_amount ?? null,max:s.monto_maximo ?? s.max_amount ?? null
    }))});
  } catch {return reply({enabled:false,message:'Error de conexión con el sandbox.'},503)}
}
