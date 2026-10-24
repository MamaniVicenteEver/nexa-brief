# Entrega · corrección de personajes

- `profe.js`: el dibujo ahora sigue la capa acordada; el saco se estrecha de hombros a cadera y deja visibles las solapas abiertas y la corbata.
- `nina.js`: la falda se dibuja entre torso/piernas y brazos; la coleta se dibuja detrás de la cabeza, sigue su inclinación y oscila con `o.t`.
- `nino.js`: la mochila queda detrás como dos paneles laterales; una correa cruza el pecho por delante del torso y queda debajo de brazos y manos.
- `obrera.js`: el overol deja los brazos delante, con peto pequeño, tirantes y pantalón trapezoidal hasta las rodillas. Quité el aro que formaba la Q junto al casco; el moño queda detrás de la cabeza.
- `abuelo.js`: el bastón sigue la mano izquierda y su extremo llega a `J.legL[1][1]`; ya no se oculta al levantar el brazo.

## Verificación

- Pasó `node --check` en los cinco archivos de personajes modificados.
- Revisé la hoja existente para localizar los defectos. No regeneré `personajes-sheet.png`: la tarea asigna la nueva captura a Claude y pide que vuelva a capturarla después de estos cambios.
- No hizo falta cambiar el contrato ni la tabla de personajes disponibles de `PERSONAJES.md`.
