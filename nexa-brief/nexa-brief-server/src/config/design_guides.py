"""Shared instructions for reusable profile designs."""

DESIGN_GUIDE = """# Diseños reutilizables

Cada diseño conserva un ID estable, una categoría y un estado independiente.
Su ficha es `design.json`, su catálogo es `catalog.json` y la entrada de vista
previa es `showcase.html`. Componentes, escenarios y personajes reutilizables
pertenecen al diseño; el guion, tiempos, audio y render de un episodio permanecen
en su producción. No dupliques ni muevas los episodios al promover un diseño.
Los motores compartidos siguen en el repositorio y se referencian por ID.

Trabaja solo en el diseño asignado. Guarda validaciones temporales juntas en
`work/results/test/`. No leas otros perfiles, `data/` ni `.system/`.
Consulta `/api/v1/showcase/designs` y el catálogo del ID seleccionado; evita leer
todos los motores. Para los parámetros de una sola pieza, usa
`/api/v1/showcase/designs/<id>/catalog/<entry_id>` y su ejemplo.
Usa el servicio de promoción para pasar de prueba a producción:
no renombres carpetas ni cambies el registro manualmente. El servicio valida,
mueve el bundle y conserva su ID y URL, sin mover episodios ni credenciales.
"""
