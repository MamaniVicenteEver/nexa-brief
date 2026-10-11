# Guía · medios (imágenes y, más adelante, video)

Resultado de este paso: `assets/media/*.jpg` + `assets/media/CREDITS.md` (y PLAN.md §8 cumplido).
Herramienta: `tools/media.py` (busca, filtra licencias, baja, recodifica y anota créditos).

## 1. Cuántas y cuáles

- **5–9 fotos por video** (una cada ~25–35 s como máximo). El resto del video lo dibujan los componentes.
- Se usan para lo que un dibujo NO puede decir: **la cara del protagonista**, **el lugar real**,
  **el objeto real** y **el documento real**. Para conceptos (una idea, un número) va un componente.
- Orden de prioridad: 1) protagonista (retrato), 2) el lugar/objeto del punto crítico, 3) el
  momento del clímax si hay foto, 4) el antagonista o la contraparte, 5) el legado/hoy.

## 2. Qué foto sirve (por diseño)

| diseño | componente | foto ideal | evitar |
|---|---|---|---|
| binary | `binary.portrait` | retrato **frontal**, cara grande, **fondo liso** (el fondo se vuelve negro solo), buena luz | grupos, caras chicas, fondos con mucho detalle |
| binary | `binary.frame` | foto documental de lugar/objeto/multitud; se ve en B/N dentro de un marco de glifos | fotos con texto superpuesto o marcas de agua |
| rough | `rough.photo` | personas, máquinas, pantallas, lugares; se muestra B/N (o lima) con zoom lento; `focus:[x,y]` apunta al sujeto | imágenes muy oscuras o de baja resolución |

- Lado mayor **≥ 1000 px** (mejor ≥ 1400). El script recodifica a ≤ 1600 px.
- Nada de fotos con marcas de agua, collages, capturas de TV con logos, ni imágenes generadas con IA
  presentadas como reales.
- Personas reales: solo fotos documentales/publicas; nada que las ridiculice.

## 3. Dónde buscar (en este orden)

1. **Wikimedia Commons** (`media.py search "<consulta en inglés>"`): fotos históricas, retratos,
   NASA/ESA, archivos (Bundesarchiv, Library of Congress, US Navy…). Probar 2–4 consultas por
   imagen: nombre + año, lugar + evento, objeto + "museum".
2. **Archivos de dominio público** que suben a Commons: NASA, NOAA, US Army/Navy, Library of Congress.
3. **Pexels** (`--source pexels`): solo para imágenes genéricas modernas (servidores, ciudad,
   teclado). Nunca para personas históricas.

Licencias aceptadas: dominio público, CC0, CC BY, CC BY-SA, Pexels License. **Rechazar**: NC
(no comercial), ND (sin derivadas), "fair use", "all rights reserved" o licencia dudosa.
Las CC BY/BY-SA exigen crédito: va en la descripción del video (manifest/publish.json).

## 4. Comandos

```bash
K=src/templates/_tools/explainer-kit/tools/media.py
.venv/bin/python $K search "Schabowski press conference 1989"           # ✓ = licencia aceptada
.venv/bin/python $K get <video-id> "File:Bundesarchiv Bild 183-1989-1109-030, Berlin, Schabowski auf Pressekonferenz.jpg" schabowski.jpg
.venv/bin/python $K list <video-id>
```

Nombres de archivo: cortos, minúsculas, sin tildes ni espacios (`schabowski.jpg`, `muro-1961.jpg`).
En el storyboard se usan como `"src": "assets/media/schabowski.jpg"`.

## 5. Verificar ANTES de usar

- Mirar la imagen (un modelo con visión o una persona): ¿muestra lo que dice el guion? ¿la cara se
  ve? ¿no hay marcas? Si el agente no puede ver imágenes, lo declara en PLAN.md §10 como riesgo.
- Revisar la descripción del archivo en Commons: fecha y lugar correctos (los archivos a veces
  traen pies de foto erróneos).

## 6. Video (pendiente)

Los componentes actuales usan fotos fijas (con zoom lento). Clips de video (Pexels Videos, NASA)
quedan para una próxima iteración: hace falta un componente `*.clip` que haga seek determinista
del `<video>` en el render cuadro a cuadro. Mientras tanto: NO bajar videos.
