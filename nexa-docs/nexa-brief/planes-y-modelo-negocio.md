# Nexa Brief — Propuesta de planes Free / Pago

**Estado:** propuesta a validar, no implementada. Hoy no existe en el código ningún sistema de planes, cuotas de usuario ni facturación (verificado por búsqueda de "plan"/"tier"/"premium"/"limit" en `src/` — no hay resultados relevantes). La única mención relacionada es un comentario a futuro en `estrategia_niche_config.md` sobre usar un modelo de IA más caro para nichos "premium", y una idea de freemium ("primeros 5 gratis") en `nexa-brief/nexa-brief-server/docs/investigaciones/motor-prompt-a-video.md` pensada para el motor de render (no para nexa-brief en sí). Este documento junta ambas ideas en una propuesta concreta para nexa-brief.

## Por qué basar los planes en cuentas por plataforma

Nexa Brief ya soporta múltiples cuentas por plataforma en `accounts.json` (estructura `plataforma.alias`). El costo real de escalar no es "generar más videos" (eso es cómputo, ya cubierto en `infraestructura/`), sino **cuántas cuentas/páginas puede publicar un mismo cliente en simultáneo**, porque cada plataforma impone su propio techo (ver la sección de límites en el [README](README.md)):

- YouTube: la cuota diaria es por proyecto de Google Cloud, no por canal.
- Facebook: sin límite práctico de páginas por Business Manager, pero requiere revisión de la app para publicar a escala.
- TikTok: apps sin auditar quedan limitadas a un puñado de cuentas de prueba.

Esto sugiere que el plan pago no vende "más videos", vende **más proyectos GCP / más cuentas autorizadas / apps ya auditadas**, que es justamente lo que un usuario individual no puede resolver por su cuenta.

## Plan Free (propuesta)

- **1 cuenta de YouTube** conectada (dentro del pool de cuota compartido de un único proyecto de GCP: ~6 subidas/día entre todas las cuentas free del sistema, o 1 cuenta con cuota dedicada si se aísla por proyecto).
- **1 página de Facebook.**
- **1 cuenta de TikTok** (en modo sandbox/no auditado — límite real impuesto por TikTok, no por Nexa Brief).
- Acceso a los nichos activos existentes (no a nichos nuevos hechos a medida).
- Sin generación en paralelo garantizada (job en cola compartida).

## Plan Pago (propuesta, a definir por tiers)

- **N cuentas por plataforma**, escalando según lo que cada plataforma permite desbloquear:
  - Más proyectos de GCP → más cuota diaria de YouTube en paralelo.
  - App de TikTok auditada → más cuentas TikTok reales, no solo sandbox.
  - Business Manager de Facebook con más páginas + permisos de publicación revisados.
- Mayor concurrencia de generación de video (jobs en paralelo, no solo en cola).
- Acceso a nichos/plantillas adicionales, o a un nicho a medida (nuevo idioma, nueva plantilla visual, voz TTS) como servicio.
- Soporte prioritario y SLA de publicación.

## Preguntas abiertas antes de implementar

1. ¿El límite se aplica por cliente final o por instancia desplegada de Nexa Brief? (Cambia si esto se vende como SaaS multi-tenant o como software que cada cliente despliega con sus propias cuentas.)
2. ¿Quién es dueño de los proyectos de GCP / apps de TikTok auditadas en el plan pago — el cliente o Nexa Brief? Afecta cumplimiento y costos.
3. Confirmar cifras exactas de cuota vigentes en cada consola de desarrollador antes de publicar números en marketing — las políticas de plataforma cambian sin aviso.
4. Ver si conviene compartir el modelo de créditos/facturación ya bocetado para nexa-render (Fase 4 de `motor-prompt-a-video.md`: Stripe, contador de uso por cliente) en vez de construir uno paralelo para nexa-brief.
