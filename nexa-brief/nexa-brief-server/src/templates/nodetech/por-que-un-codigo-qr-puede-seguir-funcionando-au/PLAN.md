# PLAN · Un QR dañado todavía puede hablar

## 1. Pedido
NodeTech, rough, narrativa documental. Prueba compacta: target_minutes=2, format=short_preparation. Status: 220–260 palabras, ≥1 foto, ≥16 momentos narrados. Continuación de storyboard con voz y transcripción existentes. Sin render ni publicación.

## 2. Tesis y emoción
Punto crítico: reconstruir una casilla borrada con una relación que sobrevivió. Tesis: la redundancia matemática permite recuperar datos dentro de límites. Asombro seguido de cautela. Apertura hipotética en una etiqueta, no experimento registrado. Puente al presente: etiquetas rayadas que todavía pueden leerse.

## 3. Investigación
Fuentes primarias consultadas 2026-11-02. Tema técnico estable, no actualidad. DENSO no indica fecha de publicación; los datos no se presentan como novedad de 2026.

| # | hecho | URL y fecha | uso |
|---|---|---|---|
| 1 | QR recupera datos ante suciedad o daño | https://www.qrcode.com/en/about/error_correction.html · s/f | tesis |
| 2 | Añade códigos Reed–Solomon a los datos | https://www.qrcode.com/en/about/error_correction.html · s/f | mecanismo |
| 3 | Existen cuatro niveles | https://www.qrcode.com/en/about/error_correction.html · s/f; https://ref.gs1.org/standards/genspecs/15.0.0/ · enero 2015 | voz |
| 4 | H recupera aproximadamente 30% de codewords | GS1 enero 2015; https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_lparen_lk_fn169.html · s/f | doble fuente primaria |
| 5 | Porcentaje sobre codewords totales, no superficie arbitraria; codeword de ocho bits | https://www.qrcode.com/en/about/error_correction.html · s/f | precisión |
| 6 | Más corrección añade redundancia y puede aumentar tamaño | https://www.qrcode.com/en/about/error_correction.html · s/f; https://ref.gs1.org/guidelines/2d-in-retail/ · consultada 2026-11-02 | costo |
| 7 | Margen vacío requerido de cuatro módulos | https://www.qrcode.com/en/howto/code.html · s/f | margen, sin cifra en voz |
| 8 | Módulos negros/blancos; capacidad depende del nivel de corrección | https://www.qrcode.com/en/about/version.html · s/f | contexto |
| 9 | Patrones de localización en tres esquinas | https://ref.gs1.org/standards/genspecs/15.0.0/ · enero 2015, sección QR Code 2005 | orientación |
| 10 | 3 + 5 = 8; si falta 5, 8 − 3 lo recupera | aritmética propia verificable; analogía, NO algoritmo QR | ejemplo |

No decir: borrar cualquier 30% del área, copia completa escondida, teléfono que adivina. Analogía supone casilla borrada conocida; Reed–Solomon real puede localizar y corregir errores con redundancia suficiente.

## 4. Título y gancho
A: Por qué tu celular lee un QR dañado. B: El truco matemático escondido en un código QR. C: Un código QR resiste daños, pero tiene un límite.
Apertura: TODAVÍA SE PUEDE LEER. Kicker: CÓDIGOS QR. Primera frase final: «En una etiqueta, una esquina del código está arrancada». Bucle: ¿cómo recupera algo que ya no se ve? Se cambió rayón por esquina arrancada después de mirar el medio, para corresponder exactamente a la imagen.

## 5. Arco
| acto | segmentos | intensidad | acción |
|---|---|---|---|
| gancho | s01 | .75 | etiqueta rayada |
| contexto | s02 | .5 | datos y redundancia |
| ejemplo | s03–s04 | .65 → .45 | relación y casilla vacía |
| revelación/clímax | s05–s06 | .8 → 1 | recuperar; mecanismo y límite |
| consecuencia | s07 | .45 | orientación y margen |
| cierre | s08 | .65 | vuelve a etiqueta y pregunta |

## 6. Letra grande
«No está adivinando»; «La información extra permite recuperar lo que falta»; «No de cualquier pedazo de su superficie». Ventanas hasta fin de oración.

## 7. Inventario visual
### 7a. Inventario
Consultado kit.py library 2026-11-02. Ninguno de los componentes aprobados representa un QR o Reed–Solomon. Sin componentes propios: objetivo orientativo cero; usar medio pertinente para el QR y catálogo para la analogía, sin iconos protagonistas.
| objeto | planos previstos | clímax | decisión |
|---|---|---|---|
| QR dañado | 2 | sí | imagen libre, rough.introv2 / rough.photo |
| relación aritmética | 3 | sí | rough.note, rough.choice con números configurables |
| esquinas y margen | 2 | no | foto y rough.annotate |
### 7b. Mapa visual (no storyboard)
s01 introv2 QR; s02 note datos + redundancia; s03 note 3 + 5 = 8; s04 choice casilla vacía; s05 note 8 − 3 = 5 y punch; s06 introv2 QR dañado; s07 photo esquinas/margen; s08 question. Continuación: ≥16 beats, anclas de lyrics, miniatura en cada tercio. Cada archivo máximo dos usos; foto 5–10 s. Si faltan medios pertinentes, buscar otro antes del storyboard.

## 8. Medios necesarios (anotado antes de buscar)
| frase ancla | archivo previsto | shows | query | escena |
|---|---|---|---|---|
| un rayón atraviesa el código | qr-danado.jpg | QR parcialmente cubierto o dañado, reconocible | damaged QR code; QR code error correction | apertura y límite |
| esos cuadrados grandes de las esquinas | qr-estructura.jpg | QR completo con esquinas y margen visibles | QR code example; QR code structure | orientación |
Buscar bancos configurados con search-concept. Si no hay clip pertinente, imagen con movimiento lento. Revisión de medios abajo; media_review en beats después de voz.

### Resultado y revisión visual
Ambas búsquedas recorrieron los bancos configurados; sin clip relevante. Descargados mediante media.py get, créditos en assets/media/CREDITS.md.
- qr-danado.jpg, 1600 × 1600, CC0: revisado visualmente. Foto de papel sobre madera con zona inferior derecha arrancada; las tres marcas grandes siguen visibles. Aprobado para la apertura y para explicar daño parcial. La ficha lo identifica como nivel Q; NO usarlo como demostración experimental del porcentaje H. No se verificó escaneando y no debe afirmarse prueba propia. Ancla definitiva: «una esquina del código está arrancada». Shows: QR impreso con papel arrancado. Query usada: damaged QR code; QR code error correction.
- qr-estructura.jpg, 220 × 220, CC0: revisado visualmente. Diagrama completo negro sobre blanco, tres cuadrados de esquina y margen claros. Aprobado como esquema del símbolo, no fotografía de una escena. Es un raster pequeño: evitar zoom que suavice o recorte módulos; revisar legibilidad en la hoja posterior y sustituir si resulta insuficiente. Query usada: QR code example; QR code structure.
- Distribución prevista: QR dañado en primer y último tercio (máximo dos usos); QR completo en segundo tercio y explicación de orientación (máximo dos). Cada tercio tendrá rough.introv2. El papel dañado puede volver al clímax, sin cambiar lo que muestra. Sin clips genéricos ni logos: las marcas no se nombran en voz.

## 9. Publicación
publish.json preliminar v2. Tres títulos y miniaturas A/B/C. Documental: C alternativa, no alarma obligatoria. Capítulos definitivos de manifest.chapters después de transcripción; no inventar tiempos. No ejecutar build en fase guion porque modifica storyboard.

## 10. Riesgos y verificación
Continuación storyboard 2026-11-02: 21 planos con audio existente y cierre automático (121,03 s). Guion intacto. Cuatro apoyos con dos imágenes CC0, cada archivo dos usos; cada tercio tiene miniatura. Ecuaciones ampliadas tras revisar ambas orientaciones. Publicación v2 con capítulos reales 0:00, 0:30 y 1:09. QC normaliza QR/cu erre y 30%/por ciento; no se detecta omisión textual. Revisión y avisos en work/visual-review.md. No se ejecutó render ni publicación.
Doble fuente primaria para porcentaje H: GS1 y Epson. Analogía explícita. No abrir los enlaces codificados en las imágenes. Ritmo efectivo, voz real, hojas de ambos formatos y checks dependientes de audio pendientes de continuación del host. Sin delegación, render, publicación ni modificación del motor.

Control final de continuación: kit.py status confirma PLAN completo, 229 palabras dentro de 220–260, medios/créditos y componentes (cero) conformes. Ocho segmentos, tres capítulos. Se conserva el objetivo de dos minutos, guion y audio existentes. Manifest actualizado: listo, 121,73 s, 21 beats. Publishing build y publishing check: cero errores y cero avisos. kit.py check: cero errores, con recomendaciones visuales documentadas en work/visual-review.md. No hay componentes propios que requieran hoja/rúbrica. usage.json se actualiza al cierre; la medición del productor la añadirá el host.
