# Nexa Academy HyperFrames

Composiciones independientes para pruebas de lecciones educativas. La
composición de Inglés valida lecciones breves y
`mathematics-division.html` valida una lección de Matemática de 60 segundos.
Ambas reciben contenido mediante variables, reproducen una narración y
muestran subtítulos sincronizados con timestamps medidos por Whisper.

## Variables principales

- `subject`: materia o categoría.
- `lessonTitle`: título de la lección.
- `lessonDescription`: descripción breve.
- `caption1` ... `caption12`: segmentos de subtítulos de la lección.
- `audioSrc`: ruta relativa a un archivo de audio dentro del proyecto.
- `accent`: color de acento de la plantilla.

## Composición de Matemática

`mathematics-division.html` está organizada en cuatro etapas: concepto,
ejemplo, resolución y práctica. El piloto usa el audio
`assets/mathematics-division-60s.mp3` y su manifiesto de timing asociado.

## Comandos

```bash
npm install
npm run check
npx hyperframes preview
npx hyperframes render --quality draft --output renders/lesson.mp4
npx hyperframes render --composition mathematics-division.html --quality draft --output renders/mathematics-division-60s.mp4
```

La composición usa un único timeline GSAP pausado y el audio queda bajo el
control de HyperFrames. No usa relojes, red durante el render ni estado mutable
dependiente del navegador.
