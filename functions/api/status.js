const API = 'https://api.recarga.do';
export async function onRequestGet() {
  try {
    const response = await fetch(API + '/v1/estado', {headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(6500)});
    if (!response.ok) return Response.json({ok:false, message:'Proveedor no disponible'}, {status:503,headers:{'Cache-Control':'no-store'}});
    return Response.json({ok:true, mode:'demo', provider:'Recarga.do', message:'Conexión de consulta disponible. No se realizan recargas.'}, {headers:{'Cache-Control':'no-store'}});
  } catch {
    return Response.json({ok:false, mode:'demo', message:'No fue posible verificar el proveedor.'}, {status:503,headers:{'Cache-Control':'no-store'}});
  }
}
