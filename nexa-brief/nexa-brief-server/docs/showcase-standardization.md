# Diseño y catálogo compartidos

Este documento conserva el procedimiento heredado v1/v2. Para perfiles v3 usa
[el layout vigente](profile-layout-v3-2026-11.md): las definiciones viven en el
repositorio y la promoción modifica únicamente el estado del perfil.

La API unifica la ficha y el catálogo sin trasladar episodios ni modificar motores integrados. Los diseños del kit se leen desde el repositorio. Las fichas administradas por perfil viven en `sandbox/designs/<categoría>/<id>` mientras están en prueba y en `designs/<categoría>/<id>` al promoverse; el índice `data/showcase/designs.json` mantiene la identidad y el estado. Los directorios del bundle incluyen `design.json`, `catalog.json`, `showcase.html`, `components`, `assets`, `sets`, `characters` y `preview`.

Para preparar el bundle de Vida en un perfil existente, sin tocar el motor ni los episodios, desde `nexa-brief-server`:

```sh
python scripts/standardize-designs.py --profile-dir /ruta/absoluta/perfil
python scripts/standardize-designs.py --profile-dir /ruta/absoluta/perfil --apply --confirm-ownership
```

El primer comando solo muestra el plan y los conteos. El segundo crea el bundle y su índice si no existen; repetirlo conserva lo existente. La confirmación declara que el diseño heredado pertenece al perfil. No se copian audios, escenarios, personajes ni episodios; la ficha de Vida conserva las referencias al motor compartido. En v2, los episodios aún no presentes en el perfil conservan su ID, pero no ofrecen vista previa. El bootstrap de diseños no cambia la versión de almacenamiento del perfil ni migra el layout v1 a v2.

En v1, solo la inicialización confirmada habilita la lectura del Sandbox histórico del repositorio para este perfil: guarda `data/showcase/legacy-source.json` con la declaración de pertenencia. Un perfil nuevo no la recibe automáticamente. En v2 el catálogo no busca episodios del repositorio, aun cuando exista esa marca.

La promoción valida ficha, catálogo y estructura, mantiene ID y revisión, usa bloqueo y diario para recuperar una interrupción, y actualiza el índice al final. Los recursos y motores compartidos siguen en el repositorio; las vistas previas los resuelven por rutas autorizadas. La herramienta no publica ni graba videos.
