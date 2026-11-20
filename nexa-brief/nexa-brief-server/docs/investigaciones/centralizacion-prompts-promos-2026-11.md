# Promos: fuente única de prompts · 12 de noviembre de 2026

La centralización está implementada y aplicada en `alfred-server`, en el repositorio `/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief`. Editorial, Sports, Dynamic, Kinetic, Trendy y Urban comparten el mismo paquete versionado. No se crean seis Markdown nuevos por video: el proyecto guarda versión y hashes; el cargador comprueba la fuente y entrega solo la etapa necesaria.

## Estructura final

```text
nexa-brief-server/src/
├── skills/nodemotion/promo/
│   ├── SKILL.md
│   ├── OPERAR.md
│   ├── prompts/
│   │   ├── active.json
│   │   ├── versions/v1/
│   │   │   ├── base.md
│   │   │   ├── investigar.md
│   │   │   ├── escribir.md
│   │   │   ├── revisar.md
│   │   │   ├── medios.md
│   │   │   ├── ritmo.md
│   │   │   ├── contexto.md
│   │   │   ├── publicar.md
│   │   │   └── miniaturas.md
│   │   └── history/narrativa-v2/  ← una copia global de los seis prompts originales
│   ├── templates/                ← seis contratos de diseño
│   └── schemas/
├── core/promo_prompts.py         ← cargador único con verificación SHA-256
└── templates/_tools/nodemotion-promo/
    ├── promo.py
    ├── prompt_migration.py
    ├── draft_workflow.py
    └── build.py / media.py / timing.py / preview_check.py

$NEXA_PROFILE_DIR/sandbox/nodemotion/ID/
├── brief.json
├── work/
│   ├── instrucciones/
│   │   ├── prompts-version.json  ← referencia para próximos trabajos
│   │   ├── prompts-history.json  ← si se migraron copias antiguas
│   │   └── revisiones…           ← decisiones específicas, sin prompts copiados
│   ├── research/{research.json,research.md}
│   └── guion.json
├── media-plan.json
├── assets/{config.json,lyrics.json,…}
├── draft.json
└── usage.json / logs/
```

## Flujo que sigue un video nuevo

`Contrato del diseño + brief → new fija versión → prompt investigar → research valida fuentes → prompt escribir → revisar → medios → ritmo → timing/build → draft → prepare → check → revisión humana`.

Desde bash en la raíz del repositorio remoto: `source scripts/profile-env.sh`; verificar el perfil, entrar a `nexa-brief-server` y usar `.venv/bin/python src/templates/_tools/nodemotion/promo/tools/promo.py`.

- `new --id ID --brief /ruta/brief.json`: crea datos y referencia; no copia prompts.
- `prompt --id ID --stage escribir`: entrega base, etapa y contrato al agente, sin guardarlos por video ni llamar por sí solo un modelo. También admite investigar, revisar, medios, ritmo, contexto, publicar y miniaturas.
- `prompts-audit --id ID`: valida la versión fijada. `--adopt` registra una referencia para trabajo futuro en un proyecto heredado sin referencia; no afirma que se usó antes.
- `prompts-migrate --id ID`: simula la migración conocida; `--apply` conserva evidencia y retira solo archivos con hashes comprobados. Rechaza variantes desconocidas.

«Preparar» de la aplicación invoca realmente la fuente común para publicación y miniaturas comerciales; con notas usa contexto comercial, en lugar del prompt de canción. Mantiene las estrategias activas por red y sus esquemas JSON. El draft recibe la referencia fijada por el proyecto y la conserva en su output y en Detalles; si se crea directamente desde la web, fija la versión activa al preparar. No cambia de versión silenciosamente al cambiar `active.json`.

Las etapas creativas completas siguen siendo trabajo del agente: la app no investiga la web, escribe el relato ni adquiere medios automáticamente. El modelo recibe las instrucciones necesarias en cada llamada; centralizar archivos no convierte esas entradas en cero tokens ni garantiza caché del proveedor. Se evita duplicar la base dentro de la misma llamada de copy.

## Qué se corrigió además

| Repetición | Resultado |
|---|---|
| Seis prompts copiados por campaña | Paquete único, versión fijada y verificación de hashes |
| Reglas comerciales incrustadas en publicación/contexto/miniaturas | Consumen el cargador común; canciones conservan su ruta |
| Preparar copy nuevo al recrear para luego sustituirlo por copy revisado | Se reutilizan Detalles antes de preparar; no se pide ese copy de nuevo |
| Recreación dependiente de `brand.left/right` de Editorial | Soporta las seis promos y conserva el diseño de miniatura correspondiente |
| Un mismo recurso repetido varias veces dentro de un slot | Una copia y una extracción de portada por ID único; conserva orden de asignación |
| Receta manual de Sports y advertencia antigua sobre recreate | Nota actualizada para remitir a la CLI compartida |
| Prompts contemplativos y prohibiciones de una prueba aplicadas a cualquier promo | v1 neutral: ritmo y límites salen del brief y del contrato de cada diseño |

El guion y lyrics temporizados, los configs de proyecto y preview, investigación JSON/Markdown, medios del output, créditos, revisiones, miniaturas y logs cumplen funciones distintas y se conservan. Los scripts de ejecuciones anteriores quedan como evidencia histórica, no como herramientas a copiar al siguiente video. La deduplicación de medios evita nuevas copias repetidas dentro de cada slot; no se hizo una limpieza retroactiva de outputs ni de otros perfiles.

## Migración aplicada

Perfil comprobado: `/home/alfred/.local/share/nexa-brief/profiles/profesional`.

Se adoptaron referencias para seis proyectos: `3x3-doce-segundos-20261112`, `barcelona-legado-promo`, `barcelona-relato-v3-20261112`, `uyuni-1`, `uyuni-editorial-20261112` y `uyuni-relato-v2-20261112`. Sports, Barcelona V3 y Uyuni V2 tenían seis archivos idénticos cada uno: se retiraron **18 copias, 23.961 bytes**, conservando los originales una vez y sus hashes/manifiestos en cada historial. La entrega local de Sports se migró del mismo modo (otras seis copias de entrega). No se atribuye v1 a resultados antiguos ni se regeneró su contenido.

## Instrucciones para agentes y verificación

Se actualizó `AGENTS.md` en raíz, servidor, templates, sandbox y nodemotion, junto con la skill y OPERAR. Los `CLAUDE.md` ya incorporan sus `AGENTS.md` mediante `@AGENTS.md`: heredan la misma regla sin duplicarla. Crear una plantilla nueva y producir un video con una existente quedan distinguidos.

Validación: **109 pruebas correctas, una omitida**, en entorno aislado con código candidato y dependencias reales del servidor. Incluye las seis plantillas y nueve etapas, captura de prompts enviados al adaptador simulado, estrategias JSON reales, no regresión de canciones, versión fijada frente a cambio de activa, hashes alterados, migración simulada/idempotente, rechazo de variantes y reutilización de medios. No hubo llamadas pagadas de IA en estas pruebas. La skill pasó `quick_validate.py`; Terra revisó de forma independiente y sus dos hallazgos se corrigieron.

El despliegue comprobó hashes de los 32 archivos modificados/agregados antes de escribir; abortaba ante cambios concurrentes. Preflight: cero jobs, drafts activos, transcripciones y procesos pesados. API saludable tras recarga. Los seis drafts siguen `prepared` y sus seis previews responden HTTP 200. La muestra posterior mostró API Python con 128.444 KiB RSS y 2,5% CPU acumulada; es una observación puntual, no una prueba de fugas. No se modificó la animación ni se renderizó/publicó un video durante esta fase.

## Ubicación y mantenimiento

La implementación operativa es la del servidor remoto. Este checkout local era anterior y divergente; no se reemplazaron sus cambios de usuario por una sincronización general. El candidato completo y el diff comprobado se conservan en `work/promo-centralizacion-20261112/` para revisión. La copia local de esta guía y las instrucciones de agentes señalan ese estado para evitar operar con herramientas antiguas.

Para modificar instrucciones futuras, crea v2 y actualiza el manifiesto; conserva v1 y sus hashes para los proyectos que la usan. El contrato visual se consulta vivo y no queda congelado por la versión editorial: si necesitas reconstruir exactamente un montaje anterior, registra también su revisión. No hay commit ni push.
