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

## Vincular pedidos D1 ↔ transacciones sandbox (fase 7)
**Requiere migración manual en Cloudflare D1 antes de usar.** Esta función NO ejecuta recargas, NO procesa pagos y NO se ejecuta en segundo plano.

1. Cloudflare → Storage & databases → D1 → `recarganet-rd-demo` → Console. Ejecutar los dos comandos en `migrations/002_sandbox_links.sql`. Se crea la tabla `sandbox_order_links` sin modificar los pedidos anteriores.
2. Cloudflare → Workers & Pages → `recarganet-rd` → Settings → Variables and Secrets. Añadir variable de texto `RECARGA_LINK_SYNC_ENABLED=true` (nuevo opt-in). Mantener `RECARGA_D1_DEMO_ENABLED=true` y `RECARGA_SANDBOX_TEST_ENABLED=false`.
3. Publicar un deployment actualizado para aplicar los cambios.
4. Abrir `/sandbox-link-admin/` e introducir un secreto de administrador válido, la referencia de un pedido D1, la `transaction_id` de una transacción Recarga.do Sandbox existente y la idempotency key **original**, capturada en aquella prueba.
5. Pulsar **Verificar y vincular**. El backend comprueba que el proveedor confirma modo sandbox y que `service_id`, **identificador completo (no enmascarado)** y monto coinciden exactamente. A continuación almacena la asociación única. Se rechazará un identificador no verificable o una transacción asociada a otra orden.
6. Pulsar **Consultar proveedor y actualizar estado D1**. Una lectura GET del proveedor asigna `SUCCESS→success`, `FAILED/REVERSED→rejected`, `PENDING/PROCESSING→pending`; D1 se actualiza con comparación del estado anterior para evitar escrituras concurrentes.
7. El editor de estados manuales deja de poder modificar pedidos vinculados. Los pedidos no vinculados siguen siendo datos ficticios.
8. Verificar el registro en `/demo-orders-admin/`.

**Limitaciones importantes:** la clave de idempotencia se introduce a partir del registro histórico: la consulta por ID de Recarga.do no confirma que pertenezca a esa clave. Esta fase sirve para asociar pruebas históricas tras una verificación estricta, no para procesar ventas reales. La sincronización se ejecuta **solo cuando el administrador pulsa el botón**; todavía no existe seguimiento automático periódico ni una transacción creada y registrada de forma atómica por la plataforma. Las credenciales públicas del sandbox son compartidas; nunca mezclar con producción. Es indispensable rotar el antiguo token de administrador publicado en conversaciones antes de habilitar funcionalidad real y adoptar control de acceso robusto y limitación de intentos.

Ejemplo del historial previo: la transacción Sandbox `84630` corresponde a Claro `8095550005`, RD$ 100, con la idempotency key originalmente registrada en la prueba. Su vinculación debe ser comprobada por el servidor y nunca presumirse solo por coincidencia de importes.

## Monitor automático de pedidos sandbox pendientes (fase 8)
- Código independiente: `cron-worker/src/index.js`; ejemplo de configuración: `cron-worker/wrangler.toml.example`. **No se ejecuta desde Cloudflare Pages**. Requiere desplegar un Cloudflare Worker separado con handler `scheduled()` y cron `*/5 * * * *` (cada 5 minutos, UTC).
- Reutilizar la **misma base de datos existente** `recarganet-rd-demo` mediante un binding D1 llamado `DB` en el Worker adicional. Requiere que ya exista `sandbox_order_links` de `migrations/002_sandbox_links.sql`.
- Establecer **en el Worker** la variable de texto `RECARGA_CRON_SYNC_ENABLED=true` cuando termine la configuración y prueba. En caso contrario no consulta al proveedor ni D1. Es una variable distinta de `RECARGA_LINK_SYNC_ENABLED` que se utiliza en Cloudflare Pages.
- Configurar dos **Secret bindings en el Worker**: `RECARGA_SANDBOX_KEY` y `RECARGA_SANDBOX_SECRET` (solo valores sandbox `rk_sbx_` y `sk_sbx_`). No copiar ni publicar claves en GitHub. Los Secrets de Pages no se propagan automáticamente al Worker nuevo.
- El worker verifica primero `GET /v1/cuenta` y exige `data.sandbox===true`. Rechaza expresamente credenciales de producción. Solo comprueba hasta 5 pedidos por ejecución que cumplan **D1 status = pending** y **provider_status = PENDING/PROCESSING**, enlazados previamente y verificados.
- Por cada pedido consulta solo `GET /v1/transacciones/{id}`. Antes de actualizar D1 exige coincidencia exacta de transacción, servicio, importe, moneda DOP y teléfono de prueba. Compara el estado anterior en SQL para evitar cambios concurrentes y marca `SUCCESS→success`, `FAILED/REVERSED→rejected`, `PENDING/PROCESSING→pending`.
- Si el estado sigue pendiente, actualiza `last_checked_at` para repartir el seguimiento. Si se pierde la conexión, el registro no se marca como realizado; se reintentará en el siguiente ciclo. No reintenta enviar ninguna recarga.
- Los registros ya terminados (`success` o `rejected`) **no se vuelven a consultar**. Las reversiones posteriores sobre órdenes `success` aún requieren diseño por separado, así como alertas y monitorización de errores.
- `fetch()` responde 404 a toda solicitud HTTP; sin interfaz pública de activación. Solo `scheduled()` realiza reconciliación.
- Los cron triggers pueden tardar hasta 15 minutos en propagarse. Comprobar la sección de Cron Events y registros del Worker. Solo activar en la cuenta de pruebas, nunca con clientes reales.
- Coste: compatible con uso pequeño en Workers Free dentro de los límites vigentes; comprobar cuotas y facturación de la cuenta.

## Laboratorio de checkout persistente (fase 9)

- `/checkout-lab/` es una **pantalla privada de pruebas**, deliberadamente separada de los seis idiomas del sitio público.
- Usa el endpoint protegido `POST /api/admin/demo-orders` para crear un pedido D1 con operador, importe y únicamente los cuatro números ficticios permitidos. No genera recargas ni pagos. No hay una función pública nueva de cobros.
- El nuevo endpoint `POST /api/admin/demo-order-lookup` requiere el secreto `RECARGA_TEST_ADMIN_TOKEN`, `RECARGA_D1_DEMO_ENABLED=true` y el binding D1 `DB`. Solo consulta D1 y su enlace sandbox ya existente; no llama a Recarga.do.
- El recibo indica `status` de D1 y, **por separado**, `provider_status` de la transacción enlazada. Un estado asignado manualmente nunca constituye comprobación del proveedor.
- El navegador consulta el estado cada 20 segundos mientras la pestaña esté visible y el estado esté abierto. No hay notificaciones externas ni almacenamiento del secreto en el navegador.
- Un pedido nuevo permanece en estado `created` y no aparece en el monitor Cron hasta ser enlazado con una transacción Sandbox y estar en estado `pending`. La creación por sí sola no ejecuta ninguna operación de proveedor.
- El checkout de clientes reales requiere todavía autenticación, manejo de datos personales, seguridad antiabuso, pasarela de pago, idempotencia transaccional persistida por el servidor y conciliación completa.

## Dispatch único de pruebas con clave persistida (fase 10)

**Migración requerida:** ejecutar `migrations/003_sandbox_dispatches.sql` en la base existente `recarganet-rd-demo`. Añade la tabla `sandbox_order_dispatches` sin alterar pedidos existentes.

La consola privada `/sandbox-dispatch-admin/` permite:
1. `prepare`: para un pedido D1 **created**, no vinculado, de **Claro, RD$100 y solo teléfonos ficticios permitidos**, genera en el servidor y guarda en D1 una UUID de idempotencia **una única vez**, antes de cualquier llamada de venta.
2. `send`: **deshabilitado por defecto** mediante la nueva variable `RECARGA_SANDBOX_ORDER_SEND_ENABLED`; requiere `true` en **Cloudflare Pages, no en el Worker Cron**, así como el secreto de administrador, D1 y claves sandbox. Verifica `GET /v1/cuenta` y exige `sandbox=true`; bloquea cuentas de producción. Reclama atómicamente `phase=prepared → sending` en D1 antes de un único `POST /v1/recargas` con la clave guardada. Un segundo intento al mismo pedido se rechaza.
3. Acepta solo `201` o `202` con un ID de transacción y comprueba con `GET /v1/transacciones/{id}` que coinciden servicio, importe, teléfono y moneda. `DB.batch` guarda la asociación y pasa la orden a `pending` de forma transaccional; el Worker Cron ya instalado la resolverá. `202` jamás se trata como `success` antes de la comprobación del proveedor.
4. Si hay timeout, resultado desconocido, falta de ID o fallo de verificación, guarda la fase `uncertain` si D1 está disponible y **no repite la solicitud automáticamente**. Debe investigarse con los identificadores existentes antes de habilitar recuperación. La respuesta del navegador nunca contiene la clave de idempotencia.
5. La función se limita a un flujo de prueba autorizado, no procesa dinero ni números reales ni está conectada al checkout público. La UI solicita confirmación adicional antes del envío.

**Antes de activar el envío:** reemplazar el secreto de administrador histórico (`RECARGA_TEST_ADMIN_TOKEN`), que fue compartido en conversaciones anteriores; aplicar y revisar la migración; confirmar el deployment; auditar los test cases. Mantener `RECARGA_SANDBOX_TEST_ENABLED=false` para el runner antiguo. No activar esta función en un entorno de clientes. Enviar no es un paso necesario para probar la creación y persistencia de la UUID.
