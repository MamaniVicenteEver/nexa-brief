# Nexa Render — Propuesta comercial: publicidad profesional

**Estado:** propuesta a validar, no implementada. Hoy Nexa Render no tiene cuentas de usuario, créditos ni facturación en código — es un servicio sin autenticación por cliente. La idea de un modelo freemium/de créditos ya estaba anticipada en `nexa-brief/nexa-brief-server/docs/investigaciones/motor-prompt-a-video.md` (Fase 4: cuentas + créditos + Stripe), pensada en su momento para "el motor genérico", que es exactamente lo que hoy es Nexa Render. Este documento retoma esa idea aplicada al giro publicitario.

## Por qué publicidad profesional

Nexa Render ya resuelve el problema técnico central de un anuncio animado: HTML/CSS/JS con timeline (GSAP u otro), grabado de forma determinista con múltiples motores, con manejo seguro de assets remotos y sandboxing por job. Lo que falta para venderlo como producto de publicidad es una capa de plantillas + oferta comercial, no motor nuevo. El ejemplo `aurel-watch` (ver [README](README.md)) es la primera prueba de ese caso de uso.

## Propuesta de modelo (freemium + créditos, siguiendo la Fase 4 ya bocetada)

- **Free:** primeros N renders gratis (la investigación original proponía 5) para evaluar el servicio con plantillas propias o de la librería `advertising/`.
- **Pago por uso / créditos:** medir costo real por job (el paso más caro identificado es la transcripción/procesamiento pesado, no la grabación en sí) y cobrar en base a eso — vía Stripe, según lo ya bocetado.
- **Plan agencia/estudio:** concurrencia dedicada (worker propio en vez de cola compartida), acceso a los tres motores sin restricción, soporte para "traer tu propio React" (Fase 4 del roadmap del proyecto, todavía pendiente).

## Qué falta para que esto sea real (no solo la capa de negocio)

1. **Librería de plantillas publicitarias**, no solo `aurel-watch`. Un solo ejemplo no es una oferta de producto.
2. **Corregir el bug de `aurel-watch`** (`window.__timelines.main` vs. `data-composition-id="aurel-watch"`, ver [README](README.md)) antes de usarlo como demo frente a un cliente.
3. **Actualizar el README del proyecto** para reflejar que Remotion y HyperFrames (con AWS) ya están implementados — hoy subestima públicamente sus propias capacidades, lo cual pesa al momento de vender el servicio.
4. **Autenticación por cliente** — hoy no existe (ni cuentas, ni límites por cliente, ni facturación).
5. Confirmar con casos reales de agencias/anunciantes qué formatos y duraciones se piden más (el ejemplo actual es 14s/1920×1080; publicidad social suele pedir también 9:16 y 1:1).
