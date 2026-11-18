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
