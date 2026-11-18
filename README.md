# RecargaNet RD

Prototipo gratuito de una plataforma de recargas móviles para República Dominicana.

## Estado actual
- Sitio responsive en español (archivo `index.html`).
- Selección de Claro, Altice o Viva.
- Montos de prueba entre RD$ 100 y RD$ 2,000.
- Validación básica del formato de teléfono dominicano (809, 829, 849).
- Resumen y comprobante descargable de **simulación**.
- Indicaciones visuales de Visa, Mastercard, American Express y PayPal, **sin integración real**.

**Importante:** el sitio es solamente una demostración. No procesa pagos, no entrega saldo ni guarda datos bancarios. La elección de operadora no verifica a qué red pertenece un número portado.

## Publicación en Cloudflare Pages
1. En Cloudflare, entrar en **Workers & Pages** y crear un proyecto Pages conectado a GitHub.
2. Seleccionar el repositorio `PuntaCanada/recarganet-rd`.
3. Rama de producción: `main`; framework preset: `None`.
4. Comando de compilación: dejar vacío; directorio de salida: `/` (raíz).
5. Publicar y comprobar la URL `.pages.dev`.

## Próximas fases (sin pagos reales)
- Pruebas automatizadas de validación y experiencia móvil.
- Separación de frontend y backend seguro.
- Integración de API sandbox de recargas.
- Sandbox de pagos con webhooks verificados y protección de duplicados.
- Revisión jurídica, antifraude, contratos y cálculo de margen antes de activar pagos.

No subir claves API ni credenciales al repositorio público.

## Comprobación de integración
- 2026-11-18: commit de prueba para verificar que Cloudflare Pages detecta cambios automáticamente después de reconectar GitHub.

## Backend Cloudflare Pages (fase 2)
- `GET /api/status`: verifica por HTTPS el endpoint público `/v1/estado` de Recarga.do y comunica disponibilidad de consulta. No accede a saldos ni ejecuta operaciones.
- `GET /api/catalog`: catálogo del sandbox **de solo lectura**, desactivado por defecto. Antes de consultar el catálogo verifica que `GET /v1/cuenta` confirme `data.sandbox === true`.
- Configuración opcional en Cloudflare → Workers & Pages → recarganet-rd → Settings → Variables and Secrets (entorno Production): definir `RECARGA_SANDBOX_KEY` y `RECARGA_SANDBOX_SECRET` como **Secrets** con credenciales de prueba. Nunca introducir credenciales reales ni subirlas a GitHub.
- Si las credenciales no se configuran, el catálogo permanece desactivado y la demo funciona normalmente.
- `POST /api/recargas` **no existe** deliberadamente. No hay pagos, compras, autorizaciones ni cuentas de clientes.
- Documentación oficial de referencia: https://recarga.do/doc/integracion.html

**Seguridad antes de abrir recargas reales:** pedidos persistentes, identidad del usuario, servidor seguro, pasarela de pago confirmada, una clave de idempotencia persistente por pedido, conciliación para estados pendientes, limitación de peticiones, antifraude y pruebas end-to-end. Los servicios de la API pueden cambiar y el catálogo no debe interpretarse como una oferta comercial activa.
