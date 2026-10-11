# Guía · revisión de calidad (QA) antes de dar un video por listo

Herramientas: `kit.py check <id>`, `kit.py sheet <id> --orient both`, `work/narration.qc.json`.
La revisión visual la tiene que hacer alguien con ojos (modelo con visión o persona). Si el agente
no puede ver imágenes, lo dice en el manifest (`qa.visual_review: "pendiente"`).

## Checklist

**Narrativa**
- [ ] El título gigante ocupa ~80% del primer cuadro y se lee en 9:16.
- [ ] El gancho plantea una pregunta o algo imposible en < 10 s.
- [ ] Hay subidas y bajadas reales; el clímax tiene letra grande y es el pico.
- [ ] El cierre vuelve al comienzo; después aparece el cierre del canal.

**Voz**
- [ ] `faltan` y `sobran` vacíos (salvo diferencias explicadas por Whisper).
- [ ] Velocidad dentro del rango del diseño; sin arranques en falso.

**Imagen (hoja de revisión, 9:16 y 16:9)**
- [ ] Ningún texto cortado ni encimado; rótulos legibles en celular.
- [ ] Cada foto muestra lo que dice la voz en ese momento; caras reconocibles.
- [ ] Ningún plano vacío o negro (salvo intencional) y ninguno repetido seguido.
- [ ] El acento (lima / blanco pleno) marca UNA cosa por plano.

**Datos y derechos**
- [ ] Toda cifra está en PLAN.md §3 con fuente.
- [ ] Cada foto tiene línea en CREDITS.md con licencia aceptada.

## Errores ya vistos (y su arreglo)

| síntoma | causa | arreglo |
|---|---|---|
| retrato binario irreconocible | fondo gris de la foto / cara chica | foto frontal con fondo liso, `size` mayor, `cell` 0.7 |
| texto que toca el borde | frase larga en 9:16 | partir con `\n`, usar `textPortrait`, acortar |
| beat que muestra la frase equivocada | ancla ambigua ("es construir") | ancla más larga y única |
| ancla no encontrada | número escrito en palabras | usar cifras ("1989") como en lyrics.json |
| "frase repetida" en el control | alucinación de Whisper | transcribir el tramo aislado antes de cortar |
| primera frase dicha dos veces | arranque en falso del TTS | `tools/splice.py --cut` |
| render colgado / fuentes raras | fuente de canvas no precargada | declarar en `Kit.fonts` |
