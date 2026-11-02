# Producción del estilo imperio

Estas reglas se aplican a `config.design: "imperio"`, incluidas las pruebas sandbox.
La fuente de umbrales es `production-policy.json → style_policies.imperio`; no cambian
las otras familias. Esta guía se lee antes de planificar medios y sonido del próximo video.

## Ventanas de medios

- Video documental visible: **8–16 s** por aparición.
- Fotografía documental visible: **6–12 s** por aparición.
- Mapas, banderas, rótulos y aperturas gráficas siguen su dirección propia: no se
  cuentan como foto/clip por durar más ni se cortan para cumplir esos límites.
- Una introducción que contiene una foto o video real sí debe respetar la ventana
  del recurso. Los fundidos forman parte de esa ventana, no se suman por fuera.
- Medir hasta el siguiente plano `main`, el outro o el final del audio, lo que llegue
  antes. Un `dur: 12` seguido de otro main a los 3 s solo deja 3 s al medio. Los
  overlays no cortan el plano. Descontar una entrada demorada como `photoAt`.
- En `imperio.campaign`, cada `plates[]` es una aparición independiente, no todo
  el plano largo del mapa. `video: "v1"` e `image: "p1"` referencian parámetros
  del componente tipados como video/image. `at: "@palabra-0.6"` se resuelve contra
  la transcripción; un `at` numérico es local al beat. Mantener plates sin solaparse
  y completamente dentro del padre; no basta declarar `dur` si el padre acaba antes.
- Reorganizar el apoyo visual conservando las anclas del relato. No recortar,
  ralentizar ni insertar silencios en la narración para alcanzar estos tiempos.

Validación normal: `kit.py check <id>`. Guarda los intervalos en
`manifest.quality.style_media` y bloquea las ventanas fuera de rango, también en demos
antiguas. Para consultar sin reescribir manifest:

```bash
.venv/bin/python src/templates/_tools/explainer-kit/tools/style_media_policy.py \
  src/templates/sandbox/nodepolitics/<id>
```

El reporte mide la ventana asignada al medio, incluidos sus fundidos, y no pretende
medir luminancia cuadro por cuadro. Antes de darlo por listo, revisar la plantilla
en vivo: encuadre, visibilidad del archivo y sentido documental. Un componente
nuevo con medios anidados necesita declarar y validar sus ventanas; el contrato
actual conoce parámetros directos y `imperio.campaign.plates`, no JavaScript arbitrario.

## Sonido: biblioteca primero, voz continua

El orquestador usa los contratos de `core/sound_design`, no endpoints del proveedor.
Ver `docs/sound-design.md` desde la raíz del servidor para el esquema y las rutas.

1. En PLAN, elegir momentos donde el objeto/acción se ve o se narra: orugas,
   motores, aviones, ambiente portuario, etc. Algunas fotos pueden llevar un ambiente
   pertinente, a volumen bajo; no poner un efecto en todas por obligación. No
   presentar sonidos de biblioteca como grabaciones históricas auténticas.
2. `GET /api/v1/sound-design/search?q=<objeto>` consulta primero biblioteca local.
   Reutilizar un `asset_id` aprobado adecuado sin descargarlo ni curarlo de nuevo.
3. Si falta un efecto, buscar candidatos de SFXMint con el adaptador existente.
   `max_duration` filtra el archivo completo: omitirlo si se puede aprovechar un
   recorte de un archivo largo. No generar ni contratar otra API para esta prueba.
4. Importar el candidato con `POST /api/v1/sound-design/import`. El servicio valida
   licencia, hash y mediciones, y lanza `sound_curator` para su ficha JSON (título,
   descripción, usos y etiquetas); registrar la duración medida y metadatos técnicos
   mediante la biblioteca. Revisar y aprobar en Recursos. No escribir otra tabla
   JSON manual ni repetir una importación que ya existe.
5. Planificar cues con `asset_id`, `start` absoluto de la película, `source_in`
   del archivo, `duration`, `gain_db`, `fade_in` y `fade_out`. Se puede recortar
   localmente: el proveedor no decide los segundos de la narración. Guardar el plan
   y una tabla legible con inicio–fin, efecto, recurso y foto/clip asociado.
   El ambiente asignado debe cubrir exactamente la ventana completa de su apoyo: si el
   video/foto dura 10 s, su ambiente dura 10 s, desde la misma entrada hasta la misma
   salida, incluidos fundidos internos. Si el archivo es corto, usar fragmentos repetidos
   con uniones suaves para ambientes aptos para bucle, o buscar un recurso más largo;
   no rellenar con silencio ni ralentizar la voz. Validar cobertura y señal hasta el final.
6. Mezclar con `POST /api/v1/sound-design/sandbox/{category}/{video_id}/mix`.
   Mantener la narración limpia en `audio.narrationSrc` (el archivo original correcto,
   con cierre si corresponde) y la mezcla seleccionada en `audio.src`. Conservar
   `soundDesign` y las rutas devueltas por el sistema; futuras mezclas toman la voz
   limpia, nunca una mezcla previa con efectos, para evitar duplicarlos.
7. Ajuste solicitado: efectos **×1,155** respecto a su plan base, equivalente a
   **+1,251640 dB** en cada cue, una sola vez. No sumar 10 dB ni elevar la voz.
   El valor final debe permanecer bajo la narración; el ducking actúa solo sobre
   el bus de efectos. Guardar base/factor o referencia al plan base para no acumular
   el 10 % en futuras mezclas.
8. Verificar duración igual a la narración completa, voz continua y sin pausas
   añadidas; comparar `mezcla = voz + efectos` con muestras reales, comprobar señal
   de los cues y picos. Escuchar transiciones y palabras inteligibles en la plantilla.
   La mezcla es un WAV completo y un stem, no un render de video.

Entrega de la próxima prueba: plantilla en vivo, intervalos de medios validados,
tabla de cues, qué recursos se reutilizaron/importaron y escucha completa. No renderizar,
promover a producción ni publicar sin que el usuario lo pida.

La validación central también comprueba `soundDesign.supportWindows` (asset_id, start, duration) contra las ventanas visuales reales y los cues del archivo `planUrl`. Rechaza ambientes cortos, huecos, prolongaciones fuera del apoyo y planes sin asignaciones. Unir fragmentos solapados para una sola ventana es válido. Las plantillas sin efectos no necesitan asignaciones.

Nivel vigente de ambientes del diseño Imperio: ×1,155 de la base inicial (el +10 % anterior y un +5 % adicional, no 5 dB). Aplicarlo una sola vez al plan base. Voz y ventanas de apoyo sin cambios.
