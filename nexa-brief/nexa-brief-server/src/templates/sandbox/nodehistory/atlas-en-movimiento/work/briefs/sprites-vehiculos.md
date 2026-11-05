# Brief · sprites-vehiculos (Sol 6.1 high) — Blender, SERVIDOR, con calma

## Objetivo
Ampliar la biblioteca de sprites cenitales con **vehículos terrestres y más buques y aviones**, con acabado profesional (recortes fotorrealistas grises con
contorno oscuro y sombra, como las referencias; nada de iconos planos). La tarea `sprites` (otra máquina, aún corriendo) ya generó el sistema:
**reutiliza sus scripts** `engine/tactico/tools/sprites/{models.py,render.py,postprocess.py,catalog.py,validate.py,README.md}` (cópialos a tu carpeta
y extiéndelos; NO edites los originales: ese proceso aún los usa). Mira `work/ref/ref5-detalle-a.jpg`, `ref5-detalle-c.jpg`, `ref3-detalle.jpg`, `ref4-bombarderos-0-3s.jpg`.

## MÉTODO OBLIGATORIO (instrucción expresa del usuario; prevalece sobre el resto del brief)
Los modelos se crean **usando las skills de Blender instaladas**, NO con scripts bpy sueltos lanzados a mano en `--background`. Al empezar, lee y sigue las tres skills (están en
`/home/alfred/.agents/skills/`): **`blender-core`**, **`blender-asset-qa`** y **`blender-pbr-materials`** (sus `SKILL.md` y las `references/` que necesites).
- **Herramienta**: el MCP `mcp__blender_servidor__*` (ya conectado a tu sesión; instancia viva de Blender 5.2 en este servidor). Una vez: `get_addon_status`, luego `get_scene_info` con límite pequeño.
  Modelado y materiales con `execute_blender_code` (modo seguro: solo bpy/bmesh/mathutils; no importes módulos del sistema ni uses `open/exec`). Revisión visual con `look` (empieza en `max_size=512`; ángulos y alambre cuando importe la topología).
- **Por cada sprite**: (1) modelar con bpy/bmesh a través del MCP (formas con volumen real: casco, orugas, torreta, ruedas, cubierta, superestructura, alas, motores; sin cubos planos); (2) **materiales PBR** con la skill
  `blender-pbr-materials` (pintura mate gris/oliva/arena, metal desgastado, caucho, cristal; roughness/metallic coherentes; Base Color sRGB, resto Non-Color); (3) **QA** con `blender-asset-qa` (comprobaciones de modo seguro:
  normales, geometría no manifold relevante, caras duplicadas, escala; resume SOLO lo que realmente corriste); (4) `look` en ángulos para validar silueta cenital y proporciones; (5) guardar el modelo.
- **Pasar `user_prompt`** a las herramientas que lo pidan con el texto literal del usuario: «EN EL SERVIDOR GENERAR MAS COMPONENTES, BUQUES, BOMBARDEROS, TANQUES, CARROS DE GUERRA, AMBULANCIA, IGUAL CON EL NIVEL DE DISEÑO QUE QUIERO
  QUE TENGAMOS PROFESIONAL … EN BLENDER PUEDES MODELAR». No inventes subtareas en su lugar.
- **Escena viva COMPARTIDA** (otras sesiones usan el mismo Blender): trabaja SOLO en tu propia colección `AEM_vehiculos` (y sub-colecciones `AEM_<sprite>`), a una distancia grande del origen (p. ej. X ≥ 10000 m) para no tapar nada.
  NUNCA borres, muevas, renombres ni resetees objetos, materiales o datos que no hayas creado tú; no cambies la escena activa, motor global ni unidades; no abras otro `.blend` sobre la sesión. Al terminar cada sprite, guarda y retira tu colección.
- **Guardado**: intenta guardar cada modelo como `engine/tactico/sprites2/blend/<sprite>.blend` (copia con `bpy.data.libraries.write` o `save_as_mainfile(copy=True)` si el modo seguro lo permite).
  Si NO lo permite, guarda el código bpy EXACTO que ejecutaste por el MCP en `engine/tactico/tools/sprites2/<sprite>.py.txt` (reproducible) y dilo en el RESULT.
- **Render final** (PNG con alfa 1024 px, sol arriba-izquierda, ortográfico cenital, máscara de sombra): vía MCP si el modo seguro permite renderizar a archivo; si no, UN job headless separado y autorizado por este brief sobre el `.blend` guardado
  (`nice -n 19 …/blender --background <archivo.blend> --threads 1 --python <script de render>`), uno a la vez. El postproceso de estados (`burning`/`wrecked`) y `sprites2.json` sigue como se describe abajo (Python/PIL).
- Hardware real: i3-8100 con Intel UHD 630, sin GPU útil. Inspecciona los dispositivos disponibles; previsualiza en baja resolución en CPU; no lances renders caros para inspección.
- Si el MCP o el modo seguro bloquea una operación, **no lo rodees** (no desactives el modo seguro ni pidas permisos): cambia de enfoque dentro de lo permitido o repórtalo en el RESULT.
- En el RESULT incluye una tabla por sprite: modelado (MCP sí/no), materiales aplicados, QA ejecutado (qué comprobaciones), `look` revisados, cómo se guardó y se renderizó.

## Archivos que puedes tocar
`engine/tactico/sprites2/` (PNG, máscaras, `sprites2.json`, `hoja2.png`), `engine/tactico/tools/sprites2/` (scripts bpy copiados y extendidos), `work/results/sprites-vehiculos.md`.
Cuando `sprites` termine, Claude fusiona `sprites2.json` en `sprites.json`: mantén el MISMO esquema de entradas (archivo, máscara, ancla, proa, eslora relativa, `variant`, `states`).

## Qué modelar (por prioridad; si el tiempo no alcanza, entrega por prioridad y dilo)
1. **Terrestres**: `tank-main` (tanque de batalla con torreta y cañón; 2 variantes de silueta), `tank-light`, `apc` (transporte blindado de ruedas), `truck-military` (camión de carga con lona),
   `truck-fuel` (cisterna), `jeep`, `artillery-towed` (obús remolcado con tubo), `artillery-self-propelled`, `missile-launcher` (lanzador sobre camión), `ambulance` (blanca; dos variantes: cruz roja y media luna roja,
   sin textos ni escudos nacionales), `bulldozer/engineer` (opcional).
2. **Buques**: `ship-amphibious` (asalto anfibio con cubierta larga), `ship-patrol` (lancha rápida/patrullera), `ship-tug` (remolcador), `ship-tanker-vlcc` (superpetrolero muy largo), `ship-platform` (plataforma petrolera vista desde arriba, opcional).
3. **Aviones y helicópteros**: `air-bomber-heavy` (4 motores, alas largas, silueta tipo bombardero estratégico, SIN marcas), `air-bomber-tactical` (alas en flecha, 2 motores), `air-transport-jet`, `air-fighter-swept`,
   `air-helicopter-heavy` (dos rotores o rotor grande), `air-uav` (dron).
Sin banderas, matrículas ni escudos en los modelos: la identidad se tiñe por código. Paleta base neutra (gris/oliva/arena teñible por máscara de zona).

## Entregable exacto
- Render ortográfico cenital, sol fijo arriba-izquierda, fondo transparente, 1024 px el lado largo, + máscara de sombra, + estados `burning` y `wrecked` (post-proceso PIL como en `sprites`), para cada sprite.
- `sprites2.json` con eslora relativa coherente (tanque ≈ 0,10 respecto al portaaviones = 1,0; camión ≈ 0,09; ambulancia ≈ 0,06; obús ≈ 0,10; bombardero pesado ≈ 0,55 de envergadura relativa a su propia escala, documentada).
- `hoja2.png`: todas las variantes y estados lado a lado sobre océano oscuro Y sobre desierto claro (para comprobar contraste), con rótulos; y la hoja a **tamaño de pantalla real** (un vehículo a 120 px, a 240 px y a 480 px) para juzgar el detalle.
- `work/results/sprites-vehiculos.md`: tiempos de render, decisiones, qué quedó simplificado, tamaño total (≤ 40 MB).

## Ritmo (obligatorio)
Servidor de 4 núcleos y 11 GB sin GPU, compartido: `nice -n 19`, Blender (jobs headless) con `--threads 1`, **un solo render a la vez**, motor Eevee/Workbench barato o Cycles con muy pocas muestras y denoise (elige y justifica por tiempo),
comprueba cada modelo en baja resolución antes del render final y cierra Blender al terminar cada sprite. Mira SIEMPRE la hoja y corrige lo que se vea plano o mal proporcionado antes de entregar.
