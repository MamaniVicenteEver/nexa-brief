# Retiro de copias históricas Binary — 6 de noviembre de 2026

Las producciones activas siguen en `profiles/profesional/productions/`, bajo
`nodehistory/` o `nodetech/` según su categoría. Se retiraron del repositorio
las carpetas históricas de `codex-titanic`,
`el-primer-vuelo-de-los-hermanos-wright-los-doce`, `turing-enigma`,
`y2k-medianoche` y `nodetech/nacimiento-ia-dartmouth`. Se conserva
`src/templates/nodehistory/muro-de-berlin` como
la demo Binary elegida por el usuario; el registro activo del perfil también
está marcado como demo. Las otras demos de diseño no forman parte de esta limpieza.

Las cinco carpetas retiradas contenían 223 archivos, 314.436.532 bytes:
129 versionados y 94 ignorados o no versionados. Antes de retirarlos se verificó
una instantánea del repositorio y los perfiles en el HDD de respaldos:
`989bb966c71ceaa53676b14393f0c0c7b043e1a9e998dc72eed4df54cae33cfe`.
Las carpetas no cambiaron desde el inicio de la copia. No se considera que todos
sus archivos sean idénticos al perfil: algunos eran versiones históricas o
estaban en ubicaciones distintas. La recuperación del respaldo sigue el flujo de
`scripts/profile_backups/README.md`; no se creó una copia de seguridad en el SSD.

Los componentes reutilizables `binary.crisisdesk`, `binary.midnightrelay` y
`binary.y2kfield` se conservaron en
`src/templates/_tools/explainer-kit/component-library/sources/binary/` y el
catálogo apunta a ellos. Se conservaron sus hojas y créditos pertinentes.

Después del retiro, las huellas de las cinco producciones del perfil coincidieron
con las previas; las vistas Binary de NodeHistory y Dartmouth respondieron HTTP
200 y los tres componentes cargaron desde el motor. Pasaron nueve pruebas de rutas, biblioteca y
diseño visual. Las eliminaciones de Git quedan para revisión; no se hizo commit.
