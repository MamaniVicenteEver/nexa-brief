# Orquestación del estilo

En `scene.json`, junto a `items`:

```json
{
  "estilo": "v4-atlas",
  "formato": "movil",
  "estiloOverrides": {
    "colores": {"acento": "#DA3B2C"},
    "estilos": {"transcripcion": {"posicion": "centro", "ancho": 70, "palabras": 3, "alto": 80}},
    "formatos": {"movil": {"ranuras": {"titular": {"arriba": 250}}}}
  },
  "items": []
}
```

`v4-atlas` y `movil` son los valores predeterminados; `clasico` se selecciona explícitamente. También se admiten `v2-mando`, `v3-cine` y `escritorio`. Se fusionan objetos y se reemplazan listas. También pueden declararse en `config.json` dentro de `configs[0]`, por ejemplo `{"configs":[{"estilo":"v4-atlas","formato":"escritorio","estiloOverrides":{"colores":{"acento":"#DA3B2C"}}}]}`. En el reproductor plano, la escena tiene precedencia y los overrides de escena se fusionan sobre los de config. Al llamar a `create` directamente, pasar los campos en la escena.

Opciones declaradas para componentes migrados (los rangos son guía de composición, no validación automática):

| Ruta | Rango | V4 por defecto |
|---|---|---|
| `estilos.transcripcion.posicion` | izq/centro/der | izq |
| `estilos.transcripcion.ancho`, `.palabras`, `.alto` | 1–100 %, 1–5, px positivos | 70, 3, 80 |
| `paneles.visible`, `.opacidad` | booleano, 0–1 | false, 0.35 |
| `velos.visible`, `.opacidad` | booleano, 0–2 | false, 1 |
| `mapa.reticula.visible`, `.opacidad`, `.grosor` | booleano, 0–1, px positivos | false, 0.1, 1 |
| `escalas.ejercito.ficha`, `.separacion`, `.maxPorFormato` | px positivos, cantidad positiva | 80×80, 12, 4/8 |
| `escalas.unidad` | factor positivo | 0.8/1 |
| `trazos.flecha.linea.grosor`, `.color`, `.dash`, `trazos.flecha.punta`, `.largoPunta`, `.anchoPunta` | px positivos, color, lista, tipo, px positivos | consultar JSON de identidad |

Estas opciones están declaradas, pero no afectan a componentes que aún no leen `env.estilo`; tampoco aplican automáticamente grado de mapa, velos o paneles. Para un video, elegir la identidad según intención editorial, fijar formato y overrides de escena, y revisar legibilidad y solapes en ambos tamaños.

Para añadir un estilo: 1) copiar un JSON existente; 2) asignar id/nombre y ajustar tokens; 3) conservar estructura de formatos, excepciones y componentes; 4) agregarlo a `estilos/index.json`; 5) correr `node engine/tactico/tools/estilo-validate.mjs`, `node engine/tactico/tools/estilo-map.mjs --estilo <id>` y revisar previsualizaciones en ambos formatos. Las vistas `work/tactico/demo.html` y `preview/tactico/demo.html` aceptan `?only=label.unit&estilo=v4-atlas&formato=escritorio`.
