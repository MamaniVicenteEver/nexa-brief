# Ediciones: contratos y resolución

`build_edition(production, locale, ...)` resuelve una edición sin generar textos,
audio ni tiempos. `python -m src.core.explainer.editions show --production <directorio>
--locale en-US` imprime el resultado; no escribe en la producción.

El resultado contiene la persona, expresión del mercado, voz, cierre, formato,
capacidades visuales, reglas editoriales de categoría, estrategias con su capa
nativa, léxico, rutas y procedencia de cada valor. Los contratos Pydantic rechazan
claves ajenas a cada capa. El formato no puede elegir voz; los ajustes de cuenta
y episodio admiten solo `format_id`, `duration_seconds`, `voice`, `channel` y
`outro`. Se aplican cuenta y después episodio; las estrategias no pueden
sobrescribir identidad, formato ni rutas.

`write_edition` congela ese resultado en `edition.json` del original español o
en `languages/<locale>/revisions/<revision>/edition.json`. No activa revisiones ni
reescribe un archivo existente con otro contenido. Los cambios posteriores de
la fuente no alteran el archivo congelado. `source_revision` identifica por hash
los datos fuente, sin moverlos. Las rutas del contenido son relativas a la
producción; `outro.audio` es relativo al kit, como indica `audio_scope`.

El resolvedor y las estrategias específicos del explainer viven en `core/explainer/editions/`; este paquete conserva esquemas y operaciones comunes. Las identidades EN/PT pueden estar en estado `draft` y sus revisiones se deben evaluar antes de publicar.

`strategies.resolve_strategy` conserva la intención universal y devuelve por
separado la capa nativa y la configuración combinada. Una capa EN/PT ausente
produce un error explícito. El español utiliza expresamente su estrategia
original. Los ejemplos y convenciones nativos están en `market` y en
`effective.native_instructions`; el bloque `universal` conserva el material de
referencia original.

`strings.extract_strings` y `apply_strings` recorren exclusivamente los campos
de `localizable.json`. Las claves son punteros estables; no se infiere el texto
por el nombre de una propiedad. Los medios, opciones, bits, códigos y direcciones
protegidos no se exponen. Las listas mixtas de notas conservan sus marcas de
tiempo. Los límites se aplican al texto modificado para permitir la ida y vuelta
exacta de fuentes históricas. Los destacados modificados deben pertenecer al
campo al que hacen referencia.

`formats.targets` calcula palabras con los wpm de la identidad y cantidades con
duración y densidad. `formats.validate_storyboard` es la validación de
capacidades para el corto animado: lista cerrada de componentes y prohibición de
medios declarados. Las duraciones inválidas se rechazan. Los lectores de
duraciones antiguos conservan su comportamiento cuando no reciben un formato.

Las herramientas del kit reciben la edición congelada mediante `--edition` y el servicio de localización coordina las etapas.

Verificación enfocada, desde `nexa-brief-server`:

```sh
.venv/bin/python -m pytest -q tests/unit/test_editions_base.py tests/unit/test_metadata.py tests/unit/test_explainer_lengths.py
```

La prueba de cobertura carga las declaraciones reales de los componentes con
Node, sin navegador, y las contrasta con ambos catálogos y `localizable.json`.
