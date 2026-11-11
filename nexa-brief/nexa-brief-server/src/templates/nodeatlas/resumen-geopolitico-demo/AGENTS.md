# Plantilla NOTICIERO · este episodio es el DEMO de referencia

Para producir videos nuevos con este estilo (voz fija Charon/aceleración, estilo visual `original` por defecto) lee `src/templates/sandbox/nodehistory/_atlas/noticiero/AGENTE.md`. Este episodio no se copia: se crea uno nuevo con `noticiero/tools/nuevo.py`.

# Atlas noticiero · estilos por JSON

Motor compartido: `nodehistory/_atlas`; no copiarlo por video.
Estilos: `original` y `dynamic-news` (Dynamic News). Elegir por `estilo` en escena/config o URL de vista previa.
Entrada rápida: `_atlas/noticiero/QUICK.md` del código compartido.
Consultar `/api/v1/showcase/designs/resumen-geopolitico-demo/styles` para obtener el design_id canónico,
luego `/production-guide?estilo=dynamic-news` y solo los contratos de las piezas elegidas.
Escena: camera y layers para geografía; hud para rótulos, alertas y datos.
Medir `__newsHud.layout().overflow` en ambos formatos, especialmente 9:16.
Si hay capacidad insuficiente, separar las piezas por anclas reales; no encoger por debajo de mínimos.
Los cinco ejemplos nuevos son ilustrativos, no evidencia noticiosa.
El proyecto conserva Sandbox; este cambio no lo promueve ni publica.
