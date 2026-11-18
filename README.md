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

## Pruebas privadas del sandbox (fase 3)
- Consola: `/sandbox-admin/`. No es para clientes; sin clave privada no puede hacer transacciones.
- Endpoint: `POST /api/sandbox-test`. **Deshabilitado por defecto** (HTTP 404).
- Para habilitarlo solo en el ambiente de pruebas de Cloudflare Pages, configurar:
  - `RECARGA_SANDBOX_TEST_ENABLED` = `true` (variable)
  - `RECARGA_TEST_ADMIN_TOKEN` = valor aleatorio secreto de al menos 32 caracteres (tipo **Secret**).
  - Conservar las credenciales `RECARGA_SANDBOX_KEY` y `RECARGA_SANDBOX_SECRET`; el código rechaza claves sin prefijo sandbox y comprueba `/v1/cuenta` antes de ejecutar.
- Abrir `/sandbox-admin/`, introducir la clave privada, elegir éxito, rechazo, pendiente o número inválido. El simulador utiliza **solo** el servicio Claro 1, RD$ 100 y números fijos `8095550005`, `8095550001`, `8095550002` y `8095550000`.
- Para probar el replay, usar el botón «Repetir con la MISMA clave». Una respuesta pendiente o incierta **no** es un fallo definitivo, y nunca se reintenta automáticamente con otra clave.
- Los identificadores generados se conservan temporalmente en la pestaña durante el test, no en una base de datos. Esta consola NO es un sistema comercial de órdenes ni sirve para dinero real.
- Al terminar, retirar o desactivar `RECARGA_SANDBOX_TEST_ENABLED` y hacer un nuevo deployment.
- Nunca publicar ni compartir el token del administrador.

Referencia: https://recarga.do/doc/integracion.html

## D1: almacenamiento de pedidos ficticios (fase 4)
El código y el panel están preparados, pero **no** se activa una base de datos automáticamente y **no** se modifican los pedidos públicos. La función `/api/admin/demo-orders` permanece deshabilitada salvo que exista la vinculación D1 `DB` y la variable `RECARGA_D1_DEMO_ENABLED=true`. El panel está en `/demo-orders-admin/`.

### Activación opcional en Cloudflare
1. En el panel de Cloudflare, ir a **Storage & databases → D1 SQL Database** y crear una base de datos llamada `recarganet-rd-demo` en el plan Free.
2. Entrar a la base de datos, pestaña **Console**, y ejecutar el contenido completo del archivo `schema.sql`. Esta tabla solo admite números ficticios de la sandbox.
3. En **Workers & Pages → recarganet-rd → Settings → Bindings → Add binding → D1**, elegir la base anterior y usar exactamente el nombre `DB` (para Production).
4. En **Variables and Secrets**, crear la variable de texto `RECARGA_D1_DEMO_ENABLED` con el valor `true`. Es independiente de `RECARGA_SANDBOX_TEST_ENABLED`, que debe permanecer en `false`.
5. Usar un **nuevo** valor secreto fuerte para `RECARGA_TEST_ADMIN_TOKEN` en Cloudflare, sin copiarlo en chats ni GitHub. La clave anterior apareció en una conversación y debe ser reemplazada antes de habilitar esta función.
6. Desplegar de nuevo el proyecto y abrir `/demo-orders-admin/`. Los registros guardados son siempre ficticios y no reflejan el estado real de ninguna recarga.
7. Desactivar `RECARGA_D1_DEMO_ENABLED` cuando no se esté utilizando el panel de pruebas.

### Restricciones
- El endpoint público `/api/demo-orders` sigue siendo una **simulación sin persistencia**.
- No existen pagos, cobros, recargas reales, seguimiento automático ni cuentas de clientes.
- No introducir información real de clientes; el administrador solo puede almacenar cuatro números falsos de prueba.
- Antes de usar D1 en producción se necesitan protección contra abuso, autenticación de clientes, permisos, trazabilidad, retención de datos, estados transaccionales seguros, recuperación de transacciones desconocidas e integración con pagos verificados.

## Estados manuales de pedidos D1 (fase 5)
- La consola privada `/demo-orders-admin/` permite actualizar manualmente `created`, `pending`, `success`, `rejected` y `unknown` en **pedidos ficticios**.
- El endpoint `POST /api/admin/demo-order-status` exige `RECARGA_D1_DEMO_ENABLED=true`, una vinculación D1 `DB` y la clave de administrador. No llama a la API de Recarga.do.
- La petición contiene `reference`, `expected_status` y `status`. La operación SQL solo se realiza si el estado actual coincide con `expected_status`; en otro caso devuelve `NOT_FOUND_OR_STATUS_CHANGED`, lo cual evita sobrescribir cambios concurrentes.
- Un estado `success` asignado manualmente **no demuestra ninguna recarga real o sandbox**. No está conectado a pedidos públicos ni a pagos.
- La consulta automática de estados reales del proveedor sigue pendiente de diseñar e implementar con almacenamiento seguro de identificadores y conciliación.

## Consulta segura de estados Recarga.do (fase 6)
- Endpoint privado: `POST /api/admin/sandbox-status` con JSON `{"transaction_id":84630}` y header `X-Admin-Test-Token`. Es una consulta **solo de lectura** a `GET /v1/transacciones/{id}`.
- Interfaz privada: `/sandbox-status/`. Introduzca la clave privada y una ID de transacción Recarga.do Sandbox existente.
- Exige `RECARGA_D1_DEMO_ENABLED=true`, `RECARGA_TEST_ADMIN_TOKEN` y credenciales `RECARGA_SANDBOX_KEY` / `RECARGA_SANDBOX_SECRET`; rechaza cuentas que no confirmen `data.sandbox === true`.
- No modifica D1 ni crea recargas. `RECARGA_SANDBOX_TEST_ENABLED` puede y debe permanecer `false`.
- Estados documentados: `SUCCESS`, `FAILED`, `PENDING`, `PROCESSING`, `REVERSED`; se rechazan estados desconocidos.
- **Aún NO hay sincronización automática D1**: la tabla de pedidos ficticios no guarda ninguna vinculación verificable con transacciones Recarga.do. Antes de actualizar estados D1 con resultados externos, hay que añadir asociación de transaction ID, importe, servicio y número e introducir un flujo de creación con IDs persistidos. Nunca asociar transacciones por mera coincidencia ni marcar las órdenes de demostración manual como operaciones reales.
- La consulta sobre una transacción existente tampoco equivale a volver a emitir la recarga.
- Documentación: https://recarga.do/doc/integracion.html#transacciones
