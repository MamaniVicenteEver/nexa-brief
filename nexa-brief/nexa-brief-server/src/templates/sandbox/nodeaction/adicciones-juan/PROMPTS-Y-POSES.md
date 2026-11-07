# Juan: hojas de poses para el prototipo

## Generación y referencias

Se generaron tres archivos independientes con la herramienta integrada de generación de imágenes y `transparent_background: true`. La primera hoja usó como referencia visual `/tmp/codex-clipboard-974df840-37b0-4606-b303-13c053bbce0a.png`. La segunda y la tercera usaron `/tmp/nexa-juan-hoja-1.png` como referencia de identidad del personaje. No se proporcionó un desglose de tokens interno de la generación de imágenes.

Cada imagen original mide **1536 × 1024 px**, en formato PNG RGBA, con una cuadrícula de dos columnas por dos filas. Cada celda mide **768 × 512 px**. Los orígenes de recorte `(x, y)` son `(0, 0)`, `(768, 0)`, `(0, 512)` y `(768, 512)`, para orden de lectura. Las esquinas tienen alfa cero; una composición de comprobación sobre blanco mostró el fondo transparente. La resolución real no es 4K y algunos pies están próximos a la división horizontal, por lo que se deben revisar los recortes. Las poses son estáticas.

Rasgos comunes: hombre joven ficticio, cabello castaño corto y despeinado, sudadera amarilla con cordones, cuello interior naranja rojizo, pantalón oscuro, zapatillas negras, piel clara cálida y contorno negro de estilo ilustrado. Hay variaciones menores de cara y postura entre figuras. No hay sustancias ni marcas.

## Índice de celdas

Filas de arriba hacia abajo y columnas de izquierda a derecha.

| Hoja | Fila | Columna | Pose representada |
|---|---:|---:|---|
| `/tmp/nexa-juan-hoja-1.png` | 1 | 1 | Preocupado, mano en la sien |
| 1 | 1 | 2 | Pensativo, mano en el mentón |
| 1 | 2 | 1 | Sentado en silla, frustrado o cansado |
| 1 | 2 | 2 | De pie, manos juntas, reflexivo |
| `/tmp/nexa-juan-hoja-2.png` | 1 | 1 | Explica con mano abierta |
| 2 | 1 | 2 | Escucha, mano sobre el pecho |
| 2 | 2 | 1 | Manos abiertas al pedir apoyo |
| 2 | 2 | 2 | Da un paso decidido |
| `/tmp/nexa-juan-hoja-3.png` | 1 | 1 | De pie y tranquilo |
| 3 | 1 | 2 | Esperanzado, manos abiertas |
| 3 | 2 | 1 | Camina hacia delante |
| 3 | 2 | 2 | Celebra un pequeño logro con el puño levantado |

## Prompts exactos enviados

### Hoja 1

```text
Use case: illustration-story. Create a transparent-background sprite sheet for a professional Spanish-language educational video about addiction recovery. Reference image is a STYLE reference only: hand-drawn friendly fine black outlines, clean white illustrated face, warm yellow hoodie, brown short hair, tasteful orange accents, expressive natural body language. Character: Juan, adult young man with short tousled brown hair, yellow hoodie, dark slim pants and black shoes; kind recognizable face, consistent design, no headphones, no brands. Composition: EXACTLY FOUR independent FULL-BODY drawings in a spacious 2 columns by 2 rows grid, all fully separated with generous transparent padding, no shadows or floor, no scene, no overlapping, no border, no text. Upper left: standing worried, one hand at temple, subtle anxious face. Upper right: standing thoughtful, hand under chin, eyes gentle. Lower left: seated on a simple small chair, shoulders tired, frustrated but not exaggerated. Lower right: standing looking down thoughtfully, hands clasped, hopeful glimmer. Preserve identity, outfit, relative scale and consistent line quality in all four. Supportive and non-stigmatizing, never depict substances or symptoms. High-detail crisp hand-rendered illustration, asset sheet for cropping, actual transparency.
```

### Hoja 2

```text
Use case: illustration-story. Input is character model reference. Make a new transparent 2x2 sprite sheet for a professional educational video. Keep EXACT same recognizable Juan young adult: short brown tousled hair, yellow hoodie, black pants, black sneakers, warm light skin, natural expressive face; same hand-drawn black outlines. EXACTLY four separate full body poses in 2 columns x 2 rows: upper left he explains calmly with one open palm; upper right he listens attentively, one hand at chest; lower left he reaches out and asks for support with both hands open; lower right he decides to take a first step, poised and determined. The character alone, no other person or props, no background, no text, no vignette, no gradient, absolutely NO glow or soft shadow; genuinely fully transparent blank areas. High-detail crisp outlines, widely spaced, no clipping. Non-stigmatizing and friendly.
```

### Hoja 3

```text
Use case: illustration-story. Input is character model reference. Make a new transparent 2x2 sprite sheet for a professional educational video. Keep EXACT same recognizable Juan young adult: short brown tousled hair, yellow hoodie, black pants, black sneakers, warm light skin, natural expressive face; same hand-drawn black outlines. EXACTLY four separate full body poses in 2 columns x 2 rows: upper left standing calm with a relaxed breath, hands at side; upper right hopeful with a gentle smile and open hands; lower left walking forward steadily, natural stride; lower right celebrates a small success with restrained smile and raised fist. The character alone, no other person or props, no background, no text, no vignette, no gradient, absolutely NO glow or soft shadow; genuinely fully transparent blank areas. High-detail crisp outlines, widely spaced, no clipping. Non-stigmatizing and friendly.
```

## Hoja reutilizable de apoyos

La hoja `assets/media/apoyos.png` contiene 4 elementos transparentes: 1.1 clínica, 1.2 manos de apoyo, 2.1 calendario, 2.2 planta con pasos. Prompt: «cuatro apoyos educativos en cuadrícula 2×2: clínica acogedora, manos de apoyo, calendario de citas sin números y planta creciente en escalones; trazo amable de pizarra, amarillo cálido, verde azulado y naranja; sin logos ni sustancias; fondo transparente y elementos separados». Resolución nativa 1536 × 1024; no 4K. Los recortes medidos están en `assets/poses-index.json`.
