# Arquitectura

## Decisión: funcionalidades con una capa de UI compartida

Se agrupa el código por responsabilidad de producto. Los niveles átomo/molécula/organismo se usan como criterio de composición, sin convertir cada etiqueta HTML en una carpeta. Esta combinación evita tanto el archivo monolítico como una jerarquía de componentes difícil de navegar.

```text
src/
  features/
    network/   # redes de marcas, propósito y emblema institucional
    channels/  # catálogo, modelo tipado, tarjetas y ficha de canal
    profiles/  # modal de plataformas, previsualización y descargas
  shared/
    ui/        # Button, Header, Footer, SocialIcon, Wordmark
    lib/       # idioma y controles generales
  layouts/     # documento, fuentes, SEO y composición común
  pages/       # rutas de Astro y generación estática
  styles/      # tokens y reglas de presentación
public/assets/ # imágenes originales, variantes, símbolos y exploraciones
scripts/       # validación del catálogo
tests/         # contratos del catálogo y protección de enlaces
```

Dependencias: páginas → funcionalidades → modelo/UI compartida. La UI compartida no conoce un canal concreto. La configuración de contenido no importa componentes. Los perfiles consumen el catálogo; no duplican descripciones ni enlaces en JavaScript de respaldo.

## Mantenibilidad

Una única fuente de contenido, tipos explícitos, componentes pequeños por responsabilidad y validación que detiene una compilación con enlaces inseguros o recursos ausentes. Cambios de color se hacen en tokens; cambios editoriales en datos; cambios de interacción en la funcionalidad correspondiente. Las fuentes son locales, los iconos se generan como SVG y no se necesitan servicios de terceros para mostrar la página.

## Escalabilidad

Astro genera las rutas a partir del catálogo. Añadir un canal genera su ficha en dos idiomas sin crear páginas a mano. Cada canal pertenece a una `networkId`; otras industrias pueden incorporarse como redes distintas. Los nombres de componentes y el esquema no dependen de que todas las futuras marcas comiencen con NODE.

## Elasticidad ante cambios

Se refiere a la capacidad de adaptar contenidos, plataformas y familias de marcas con cambios acotados. No se promete escalado automático de infraestructura. La salida estática puede replicarse o alojarse en CDN sin sesiones ni estado compartido. Si se necesita un CMS o API en el futuro, un adaptador podrá alimentar el mismo contrato del catálogo.

## Lo que ejecuta el navegador

JavaScript solo para tema, menú móvil, diálogo, pestañas, portapapeles y exportación de imágenes. El contenido y las fichas son HTML generado por Astro. No se monta una SPA ni un runtime React. El modal usa `<dialog>` nativo, restaura foco, responde a Escape y ofrece pestañas con teclado. El idioma se resuelve mediante rutas estáticas.

## Límites de la primera versión

Las vistas de redes representan la identidad guardada, no un feed en vivo. No hay conexiones OAuth, publicación ni consulta a cuentas reales. El botón de visita abre la URL confirmada. No se muestra una cuenta interna de administración como perfil público. La geometría institucional se configura con posiciones porcentuales; una red con más canales requiere componer y revisar su distribución, además de añadir los datos.

Las vistas web usan emblemas WebP generados con `astro:assets`; las descargas conservan los PNG originales. Las fuentes locales incorporan únicamente los archivos latinos normal e itálico necesarios. El portapapeles usa la API moderna en HTTPS y un fallback acotado de `execCommand` para la dirección LAN HTTP; Astro señala este último como API obsoleta, sin impedir comprobación ni compilación.
