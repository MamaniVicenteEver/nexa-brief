# Limpieza de producciones NodeTech — 2026-11-06

La muestra de Rough es `nodetech/lo-que-le-contas-a-la-ia-no-es-privado-tus-chats`, con `demo: true` en el repositorio y en el perfil profesional. Las producciones activas del perfil se consultan en `profiles/profesional/productions/nodetech`; el registro de la muestra en el perfil sigue siendo el que utiliza la aplicación.

Se retiraron siete carpetas antiguas de `src/templates/nodetech`: `apolo-1202`, `clonan-tu-voz-con-3-segundos-de-audio-las-llamad`, `codex-ariane-501`, `ia-despidos-programadores-amazon`, `por-que-un-codigo-qr-puede-seguir-funcionando-au`, `programadores-nueva-era` y `vago-pero-emocionante`. Antes se verificaron los hashes de sus archivos contra las producciones y los renders del perfil. Los archivos con contenido distinto se conservaron en cada producción bajo `work/repository-legacy/`; dos componentes únicos se conservaron en `work/components/`. Se preservaron también dos variantes locales de `usage.jsonl`.

Se retiraron 387 archivos del servidor, con 745.246.429 bytes lógicos. También se retiraron las copias correspondientes de los árboles de trabajo. Las carpetas del perfil se comprobaron por hash antes y después de la retirada. La instantánea previa verificada en el HDD fue `82333d54d4d9fcc1f66c6d30f2d339b47f7ee0fc08d1867496b5c1312d095cb1`.

Ocho componentes Rough reutilizables ahora tienen sus fuentes en `_tools/explainer-kit/component-library/sources/rough/`; el catálogo conserva su procedencia y usa allí las fuentes y las hojas compartidas. Las versiones de los componentes de cada producción siguen en su perfil. El motor no se movió.

La selección de demostración de cada diseño prioriza la marca explícita `demo` dentro de su categoría. Las demos explícitas de Sandbox se muestran identificadas como tales cuando no existe ya una demo del mismo diseño, sin promover ni copiar el proyecto.
