# Catálogo visual compartido

`pnpm build` genera el índice completo `dist/catalog.json`, ordenado por ID. No se listan miles de entradas manualmente aquí: `pnpm run stats` muestra las cantidades instaladas y `pnpm run search <texto>` permite encontrar recursos. Usa `--provider simple-icons`, `--provider lucide` o `--provider devicon` para limitar la búsqueda.

| Familia | Proveedor | Ejemplo de ID | Tipo |
| --- | --- | --- | --- |
| Marcas | Simple Icons | `brand.simple-icons.github` | SVG de marca |
| Iconos generales | Lucide | `icon.lucide.server` | SVG de contorno |
| Herramientas y lenguajes | Devicon | `tech.devicon.python.original` | SVG de tecnología |

Los ID incluyen el proveedor para evitar confusiones entre marcas y dibujos de bibliotecas distintas. Los SVG de Devicon incluyen el nombre de la variante; no se presupone que una variante esté disponible para todos los recursos. Los nombres en español se incorporan para conceptos frecuentes y se pueden ampliar en `scripts/build-catalog.js`; los demás se pueden buscar por nombre o etiquetas originales.
