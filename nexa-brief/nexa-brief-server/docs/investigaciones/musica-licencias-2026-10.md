# Música para Reels por API — 25-10-2026

## Criterio de uso

Para un MP4 publicado por API se incorpora el audio al archivo antes de subirlo. El equipo debe tener permiso de sincronización, reproducción, distribución y uso comercial para **la composición y la grabación**. Descargar una canción o verla en el selector de Instagram no concede esos permisos. [Meta explica](https://www.facebook.com/help/instagram/402084904469945) que su biblioteca musical licenciada es para usos personales no comerciales y puede restringirse para cuentas de empresa. Meta Sound Collection se ofrece en las herramientas de creación y para anuncios, pero no hay una ruta documentada en la API de publicación para seleccionar una pista de esa colección: este flujo no la usa.

[CC0](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en) permite uso comercial y adaptación sin atribución obligatoria, sujeto a derechos de terceros que el autor no controle. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode) permite el uso comercial y declara expresamente que sincronizar música con imagen genera material adaptado. Requiere nombre del autor, título, enlace a la obra y licencia, y aviso de modificaciones. Para esa modalidad, colocar la atribución en el caption de cada red antes de publicar. Excluir NC (uso comercial), ND (sin adaptaciones), licencias ambiguas y pistas sin prueba por obra. Las bibliotecas libres son fuentes de descubrimiento, no una licencia colectiva: se comprueba la página de cada pista y se conserva su hash.

El archivo `data/library/music.json` contiene 34 pistas con `license_note` desconocida. Queda fuera del catálogo apto para Reels. El adaptador solo acepta los IDs del catálogo local nuevo y verifica hash y metadatos; no permite que el cliente invente una licencia.

## Catálogo mínimo verificado

Las cinco pistas siguientes aparecen con licencia **CC0** en la [página de origen de Pop Music](https://opengameart.org/content/pop-music) o en la [página de Chills](https://opengameart.org/content/chills). Pop Music atribuye las cuatro primeras a Pro Sensory / Alex McCulloch; el autor confirma que el crédito es cortesía, aunque se conserva siempre. Chills figura bajo Holizna. No se usa la etiqueta «royalty free» como sustituto de la licencia. Las descargas y el manifiesto con URL exacta, atribución y SHA-256 están en `data/media-cache/reel_music/`, ignorado por Git.

| ID | Obra | Autor | Origen/licencia | SHA-256 |
|---|---|---|---|---|
| `oga-lay-low` | Lay Low | Alex McCulloch | [Pop Music](https://opengameart.org/content/pop-music), CC0 | `385a839abc68d0fdc24b588ad293fe7e116fc0c978dc866a6a54259119b043b3` |
| `oga-forest` | Forest | Alex McCulloch | [Pop Music](https://opengameart.org/content/pop-music), CC0 | `30b7c13a2a2db691d377907512b600ada684ace65903625ebf22ccce1881c44e` |
| `oga-high` | High | Alex McCulloch | [Pop Music](https://opengameart.org/content/pop-music), CC0 | `6ebccc28cef29de41cd2fe8fe0cbb6e7b5a0f5c46cad91f9e8cc841b58c1c5fe` |
| `oga-jay` | Jay | Alex McCulloch | [Pop Music](https://opengameart.org/content/pop-music), CC0 | `bfd4aefc962c7346405bc348f432b8c3f0430bcbbb22fd64b86478eebe49b1ce` |
| `oga-chills` | Chills | Holizna | [Chills](https://opengameart.org/content/chills), CC0 | `88cf8c964ea08b7eca071332ce57ebb33a09838f02cccda0ade8e792c6bc6e2c` |

Las cinco se presentan como pistas instrumentales en el selector. Antes de una publicación real, el editor escucha el fragmento concreto, comprueba que encaje con la pieza y conserva el crédito en el caption. La prueba de este trabajo genera un archivo local y no publica.

## Flujo implementado

El selector consulta `/api/v1/image-posts/music`. Al guardar, el servidor coteja ID, hash y licencia con el catálogo ignorado por Git y comprueba los bytes de la pista. En la aprobación, `render_reel_frames` produce PNG verticales a 30 fps; ffmpeg codifica H.264/AAC, 8–20 s enteros, aplica fades de 0,4 s y normaliza hacia −14 LUFS con techo −1 dBFS. Se guarda el MP4 por hash a través de `MediaStoragePort` y `technical.reel` registra clave lógica, tamaño y SHA-256. La entrega Reel usa el publicador existente.
