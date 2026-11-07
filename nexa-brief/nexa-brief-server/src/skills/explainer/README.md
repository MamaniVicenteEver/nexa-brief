# Estrategias de publicación de los explainers

Cómo se escriben y se validan la intro, las miniaturas, los títulos, la descripción y los tags de los videos de
NodeTech, NodeHistory, NodePolitics y NodeEconomy. Misma forma que las de NodeMotion (`src/skills/output/copy/`):
**la estrategia son datos, no código**.

```
active.json                 qué estrategia usa cada pieza: "_default" + excepciones por categoría
categories/<id>.json        perfil editorial: canal, emoción, anclas, estrategias de gancho preferidas,
                            qué evitar y hashtags fijos por plataforma
strategies/<pieza>/<id>.json
  title/        ANCLA + TENSIÓN + DETALLE, 3 opciones, las 10 estrategias de gancho
  thumbnail/    modo solo texto (5–9 palabras) y modo texto + imagen (2–5), criterios de imagen
  platforms/    Facebook (primera línea) y TikTok/Reels (texto 0–3 s, caption, hashtags prohibidos)
  description/  los 9 bloques, sus títulos y las reglas de capítulos de YouTube
  gratitude/    las variantes de agradecimiento que rotan
  tags/         cantidades de tags y hashtags por plataforma
  pinned/       comentario fijado: dato extra + 2 preguntas (tema y próximo video), tono natural
  narrative/    arco del guion (amarillista por defecto, documental): módulo aparte, ver
                src/core/explainer/narrative/README.md
```

Los fundamentos están en `docs/investigaciones/`: `titulos-gancho-categorias-node-2026-10.md`,
`paquete-publicacion-node-2026-10.md` e `integracion-estrategias-explainer-2026-10.md`.

## Cambiar una estrategia

1. **No edites una estrategia que ya se usó en producción.** Cópiala a `…_v2.json` (cambiando también su `id`) y
   edita la copia. Así siempre se puede volver atrás, y `publish.json → strategies_used` sigue diciendo con qué se
   armó cada video.
2. En `active.json`, apunta la pieza a la versión nueva: para todas (`_default`) o solo para una categoría:
   ```json
   { "_default": { … }, "node_history": { "title": "title_anchor_tension_v2" } }
   ```
3. Valida los paquetes con la estrategia nueva:
   ```bash
   uv run python -m src.core.explainer.publishing check
   ```
   Un archivo mal formado (campo que falta, rango imposible, id que no coincide con el nombre) se rechaza con un
   mensaje claro, y `tests/unit/test_publishing_strategies.py` lo valida en la CI.

Los archivos se releen cuando cambian: no hace falta reiniciar el servidor. Un campo desconocido (p. ej. un typo
como `max_char`) también se rechaza: nunca queda ignorado en silencio.

## Qué se valida y qué es guía

`check` controla todo lo que tiene un número o una lista cerrada: cantidad y largo de títulos, estrategia de gancho
existente, palabras y renglones de las miniaturas, que no repitan palabras de su título de pareja, imagen con
crédito, largos de Facebook y TikTok, hashtags prohibidos y obligatorios, reglas de capítulos de YouTube, largo de
la descripción armada, variante de agradecimiento, tags y que **cada cifra escrita con dígitos** en títulos,
miniaturas e intro esté en el guion o en la transcripción.

### La intro de la miniatura con imagen

`thumbnail.with_image` se dibuja con `<diseño>.introv2`: el texto en una mitad y la foto en la otra.
`thumbnail.with_image.image_side` elige el lado de la foto en 16:9:

| valor | efecto |
|---|---|
| `"auto"` (por defecto) | alterna entre videos según el texto: dos videos seguidos no tienen la misma intro |
| `"left"` / `"right"` | lo fija; útil para que el rostro mire hacia el texto |

En 9:16 la foto va siempre arriba (abajo la interfaz de TikTok/Reels la taparía). El encuadre de la foto
(`zoom`, `focusX`, `focusY`), el contraste y el brillo del texto son parámetros del componente: están
documentados en `src/templates/_tools/explainer-kit/CATALOG.md` (`binary.introv2`).

Son **guía** para quien escribe (persona o IA) y no se validan automáticamente: `template` de cada estrategia de
gancho, `wow_filter` (títulos), `image_criteria` (miniatura con imagen) y `emotion`/`anchors`/`avoid` del perfil de
la categoría.

## El paquete de un video (`publish.json` v2)

El modelo está en `src/core/explainer/publishing/package.py`. Se escriben las piezas (intro, miniaturas, títulos,
bloques de la descripción, fuentes, créditos, tags, comentario fijado); el código arma la descripción final, elige
el agradecimiento y deriva los campos planos de v1 que leen el grabador y el publicador. Después de editar un
paquete:

```bash
uv run python -m src.core.explainer.publishing build <video_id>
```

Eso reescribe `publish.json`, lleva la intro al cartel de apertura (y borra los renders que tenían la intro vieja),
sincroniza `manifest.json`, regenera la portada y muestra lo que falta corregir.
