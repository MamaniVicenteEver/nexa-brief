# Pizarra ilustrada · La historia de Juan

Prototipo de 8–14 minutos en español, con voz única, transcripción por palabra y caso ficticio sobre consumo problemático de alcohol. El contenido se documenta en `FUENTES.md`. No se graba ni exporta MP4: se revisa en Plantillas.

## Diseño y reutilización

Motor `nodeaction/_pizarra` y reproductor `_proto`; introducción y salida del reproductor común. Juan aparece a la izquierda; a la derecha, un panel editorial con gráficos y títulos breves. Paleta: blanco, carbón, verde petróleo suave y amarillo cálido. Subtítulos pequeños en la zona inferior.

El componente `props/imagenes.js` precarga las hojas RGBA y utiliza recortes normalizados. `props/contexto.js` añade panel, red y ruta animada; se reutilizan reloj, cerebro, burbuja, calendario, planta y otros de `props/estudio.js`. Las poses y coordenadas están documentadas en `assets/poses-index.json` y el storyboard en `work/storyboard.json`. Las poses son imágenes estáticas; su entrada y el resto de la escena se animan de forma determinista.

Las tres hojas de Juan y la hoja de apoyos son 2×2 de 1536×1024 px; no son 4K. Hay que revisar cada recorte en su contexto, sin suponer cuadrículas más densas ni ampliar como si tuvieran resolución infinita. Las cifras de uso de imagen no las expone la herramienta y no deben presentarse como cero.
