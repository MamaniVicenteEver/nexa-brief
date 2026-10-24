# PLAN · ¿Fue el año 2000 la mayor estafa informática?

> Diseño: **binary (NODEHISTORY)** · carpeta de pruebas · objetivo: 13 minutos.

## 1. Pedido

- **Tema:** historia del problema del año 2000, centrada en la noche del 31 de diciembre de 1999 y el paso de medianoche por los husos horarios; objetivo crítico: explicar la paradoja entre un riesgo real y una noche mayormente tranquila.
- **Público:** curiosos de 18–40 años, público general, sin conocimientos previos de programación.
- **Duración:** `target_minutes: 13`.
- **Formato:** narración en español latino neutro, composición vertical y horizontal, sin render ni publicación.

## 2. Tesis y emoción

- **Punto crítico:** el primer cambio de fecha reportado en tierra, en Millennium Island (Caroline Island), normalmente deshabitada, mientras en distintos países ya había equipos de guardia esperando informes. Chatham fue el primer lugar permanentemente habitado; la medianoche no fue un único instante: el planeta la fue atravesando durante un día.
- **Tesis:** Y2K fue un defecto técnico auténtico; el hecho de que hubiera pocas interrupciones graves no demuestra que fuera una estafa, porque millones de correcciones, pruebas y planes de contingencia precedieron al cambio. El costo fue enorme y estimado de maneras distintas; si fue proporcionado no puede probarse con el contrafactual que nunca ocurrió.
- **Emoción dominante:** tensión que se convierte en alivio y después en duda honesta.
- **Puente al presente:** seguimos dependiendo de formatos de fecha heredados; el ejemplo de 2038 se explica como un límite específico de contadores Unix con signo de 32 bits, no como un apocalipsis universal.

## 3. Investigación (hechos verificados)

Fuentes consultadas el 20 de octubre de 2026. Fechas de publicación junto a cada referencia. Los informes con estimaciones no se presentan como auditorías finales.

| # | hecho verificado | fuente (URL y fecha) | ¿se usa? |
|---|---|---|---|
| 1 | El informe de la National Audit Office británica explica que algunos sistemas guardaban solo los dos últimos dígitos del año por memoria/costos y compatibilidad; `00` podía confundirse con 1900. | [NAO, *The Millennium Threat: 221 Days and Counting*, mayo de 1999](https://www.nao.org.uk/wp-content/uploads/1999/05/n9899436.pdf), pp. 8–9. | Sí, explica el bug. |
| 2 | El fallo no era que toda computadora entendiera `00` igual: el riesgo dependía de cada campo, comparación y regla de negocio. | [NAO, mayo de 1999](https://www.nao.org.uk/wp-content/uploads/1999/05/n9899436.pdf), pp. 8–10; [GAO, *Year 2000 Computing Challenge*, 12 sep. 2000](https://www.gao.gov/assets/aimd-00-290.pdf). | Sí, evita simplificar. |
| 3 | El cambio de siglo también podía afectar dispositivos integrados y dependencias entre organizaciones; el NAO recomendó revisar continuidad y proveedores. | [NAO, mayo de 1999](https://www.nao.org.uk/wp-content/uploads/1999/05/n9899436.pdf), pp. 10–12. | Sí. |
| 4 | Millennium Island (Caroline Island), en Kiribati, estaba en UTC+14 y fue la primera tierra reportada en entrar en 2000; AP dijo que normalmente estaba deshabitada. La hora de Greenwich se deriva del huso: 00:00 local menos 14 horas = 10:00 UTC del 31 dic. | [AP, 30 dic. 1999, *Ringing in the New Year Worldwide*](https://www.deseret.com/1999/12/30/19483185/ringing-in-the-new-year-worldwide/); [IANA tzdb, registro histórico Pacific/Kiritimati (Line Islands), consultado 20 oct. 2026](https://data.iana.org/time-zones/tzdb/australasia), líneas 454–464. | Sí; hora calculada del huso, no una frase textual de AP. |
| 5 | Las islas Chatham de Nueva Zelanda estaban en UTC+13:45 durante el horario de verano de octubre de 1999; su medianoche llegó 15 minutos después de Millennium Island (UTC+14). AP las describió como el primer lugar permanentemente habitado. Auckland entró después. | [IANA tzdb, reglas de Chatham y Auckland](https://data.iana.org/time-zones/tzdb/australasia), líneas 532–547; [Timeanddate, cambios de Chatham en 1999](https://www.timeanddate.com/time/change/new-zealand/chatham-islands?year=1999); AP, 30 dic. 1999, [*Ringing in the New Year Worldwide*](https://www.deseret.com/1999/12/30/19483185/ringing-in-the-new-year-worldwide/). | Sí, diferencia calculada a partir de UTC+14 y UTC+13:45. |
| 6 | La cobertura contemporánea distinguió Millennium Island, tierra normalmente deshabitada que entró primero, de Chatham, primer lugar permanentemente habitado. No se presenta a todo Kiribati como una única zona ni se atribuye una multitud al primer minuto. | AP, 30 dic. 1999, [*Ringing in the New Year Worldwide*](https://www.deseret.com/1999/12/30/19483185/ringing-in-the-new-year-worldwide/). | Sí, matiz geográfico central. |
| 7 | El presidente de EE. UU. creó un consejo de conversión Y2K; John Koskinen fue su director y el informe final se publicó el 29 de marzo de 2000. | [Rice University Archives, ficha del informe y fecha](https://archives.library.rice.edu/repositories/2/archival_objects/53905); original citado como [*The Journey to Y2K: Final Report*, 29 mar. 2000](http://www.y2k.gov/docs/LASTREP3.htm). | Sí, como contexto institucional; la URL original puede estar archivada. |
| 8 | El comité especial del Senado de EE. UU. tituló su balance *Y2K Aftermath: Crisis Averted* y afirmó que el esfuerzo preventivo había sido necesario. | [U.S. Senate Special Committee, informe final, 29 feb. 2000](https://www.govinfo.gov/content/pkg/GOVPUB-Y1_3-PURL-LPS90964/pdf/GOVPUB-Y1_3-PURL-LPS90964.pdf), pp. 3–4. | Sí, atribuido al comité. |
| 9 | Ese informe estimó alrededor de 100.000 millones de dólares para preparación Y2K de empresas y gobierno en EE. UU.; no es una contabilidad mundial auditada. | [Senate Special Committee, 29 feb. 2000](https://www.govinfo.gov/content/pkg/GOVPUB-Y1_3-PURL-LPS90964/pdf/GOVPUB-Y1_3-PURL-LPS90964.pdf), pp. 3–4; [Departamento de Comercio, *The Economics of Y2K*, 17 nov. 1999](https://www.commerce.gov/sites/default/files/migrated/reports/y2k_1.pdf), pp. 2–3. | Sí, cifra estimada y redondeada. |
| 10 | El informe del Departamento de Comercio citó una estimación IDC de 114.000 millones de dólares de gasto estadounidense de software para Y2K entre 1995 y 2001; incluyó proyecciones y categorías definidas por el modelo. | [U.S. Department of Commerce, 17 nov. 1999](https://www.commerce.gov/sites/default/files/migrated/reports/y2k_1.pdf), tabla 1, pp. 2–3. | Sí, como estimación distinta, no sumada a la anterior. |
| 11 | El informe del Senado recogió 8.340 millones de dólares de gasto federal según OMB; otro balance contemporáneo de Koskinen habló de aproximadamente 8.500 millones. | [Senate Special Committee, 29 feb. 2000](https://www.govinfo.gov/content/pkg/GOVPUB-Y1_3-PURL-LPS90964/pdf/GOVPUB-Y1_3-PURL-LPS90964.pdf), p. 4; [entrevista del Departamento de Estado a John Koskinen, 27 ene. 2000](https://usinfo.org/wf-archive/2000/000127/epf407.htm). | Sí, rango y atribución. |
| 12 | Koskinen describió el gasto total estadounidense público y privado como cerca de 100.000 millones, y calculó entonces un orden mundial cercano a 200.000 millones. | [Departamento de Estado, entrevista a Koskinen, 27 ene. 2000](https://usinfo.org/wf-archive/2000/000127/epf407.htm). | Sí, explícitamente como estimación de la época. |
| 13 | El Senado también recogió la estimación IDC Project Magellan de 320.000 millones de dólares a escala global, incluyendo 134.000 millones en EE. UU.; es otra metodología, no una cifra consensuada. | [Senate Special Committee, 29 feb. 2000](https://www.govinfo.gov/content/pkg/GOVPUB-Y1_3-PURL-LPS90964/pdf/GOVPUB-Y1_3-PURL-LPS90964.pdf), nota 4, p. 4. | Sí, junto con la cifra de Koskinen para mostrar incertidumbre. |
| 14 | El gobierno británico estimó £380 millones para el gobierno central y describió el cambio como “business as usual”, con problemas menores y sistemas importantes corregidos previamente. | [Hansard, Cámara de los Comunes, 20 ene. 2000](https://api.parliament.uk/historic-hansard/commons/2000/jan/20/millennium-bug). | Sí, cifra con alcance explícito. |
| 15 | Una respuesta parlamentaria británica del 7 de febrero volvió a citar £380 millones para departamentos/agencias y £58,4 millones de subvenciones de Action 2000. | [Hansard, respuesta escrita, 7 feb. 2000](https://api.parliament.uk/historic-hansard/written-answers/2000/feb/07/millennium-bug). | Sí, segunda referencia oficial para el costo británico. |
| 16 | El Senado registró cientos de incidentes comunicados, en su mayoría menores y corregidos rápidamente; advirtió que no todos estaban verificados ni atribuidos específicamente a Y2K. | [Senate Special Committee, 29 feb. 2000](https://www.govinfo.gov/content/pkg/GOVPUB-Y1_3-PURL-LPS90964/pdf/GOVPUB-Y1_3-PURL-LPS90964.pdf), pp. 3–4 y apéndice II. | Sí, con la cautela del informe. |
| 17 | Poco después de la medianoche de Greenwich, una falla en el procesamiento terrestre de un sistema satelital de inteligencia del Departamento de Defensa de EE. UU. redujo su capacidad; respaldo permitió atender necesidades prioritarias a menor capacidad. | [GAO, *Year 2000 Computing Challenge*, 12 sep. 2000](https://www.gao.gov/assets/aimd-00-290.pdf), pp. 7–8. | Sí, incidente grave documentado y con escala. |
| 18 | El GAO dijo que ese sistema volvió a estar plenamente operativo el 3 de enero de 2000. | [GAO, 12 sep. 2000](https://www.gao.gov/assets/aimd-00-290.pdf), p. 8. | Sí. |
| 19 | Medicare recibió al menos 50.475 reclamaciones con fechas incorrectas de 872 remitentes, reportadas por 45 contratistas hacia mediados de febrero; no equivale a 50.475 pacientes dañados. | [GAO, 12 sep. 2000](https://www.gao.gov/assets/aimd-00-290.pdf), pp. 8–9. | Sí, para mostrar fallas pequeñas y concretas. |
| 20 | La FAA registró problemas de fecha en el sistema de alerta de cizalladura de viento de bajo nivel en ocho sitios; equipos mostraron años futuros y descartaron datos meteorológicos. | [GAO, 12 sep. 2000](https://www.gao.gov/assets/aimd-00-290.pdf), p. 9. | Sí, con escala y contingencias. |
| 21 | La FAA informó al GAO que esos problemas no afectaron seguridad, servicio ni capacidad del sistema nacional; se aplicaron arreglos y planes de contingencia. | [GAO, 12 sep. 2000](https://www.gao.gov/assets/aimd-00-290.pdf), p. 9. | Sí, para evitar alarmismo. |
| 22 | El Senado describió personal extra en centros de operaciones el día del cambio: el Information Coordination Center tenía 175–200 personas y FEMA alrededor de 800 entre centros. | [Senate Special Committee, 29 feb. 2000](https://www.govinfo.gov/content/pkg/GOVPUB-Y1_3-PURL-LPS90964/pdf/GOVPUB-Y1_3-PURL-LPS90964.pdf), p. 7. | Sí; personal, no víctimas ni fallas. |
| 23 | Empresas tecnológicas montaron centros de coordinación para la noche; un reportaje contemporáneo describió los centros de Microsoft y 6.000 empleados de guardia globales. | [Wired, *Silent Night in the Tech World*, 31 dic. 1999](https://www.wired.com/1999/12/silent-night-in-the-tech-world/). | Parcial; se narra la existencia de salas de crisis, no se usa la cifra. |
| 24 | La demanda por personal con experiencia COBOL llevó a empresas a volver a contratar a programadores jubilados; el reportaje incluye el caso de Bruce Fassett y una campaña de reclutamiento. | [Los Angeles Times, *Bug Re-Boots Cobol Experts’ Fading Careers*, 21 sep. 1998](https://www.latimes.com/archives/la-xpm-1998-sep-21-fi-24932-story.html). | Sí, ejemplo individual atribuido. |
| 25 | El problema del día bisiesto también produjo reportes el 29 feb. 2000: medios contemporáneos informaron que hasta 1.200 de 25.000 cajeros postales japoneses se detuvieron; el ministerio todavía no había establecido la causa exacta. | [Los Angeles Times/Bloomberg, 29 feb. 2000](https://www.latimes.com/archives/la-xpm-2000-feb-29-fi-3740-story.html); [Deseret News/AP, 29 feb. 2000](https://www.deseret.com/2000/2/29/19493412/leap-day-arrives-with-few-computer-glitches-worldwide/). | Sí, con reserva causal. |
| 26 | AP informó que seis observatorios meteorológicos japoneses no reconocieron el día bisiesto y una estación reportó lluvia con cifras incorrectas. | [Deseret News/AP, 29 feb. 2000](https://www.deseret.com/2000/2/29/19493412/leap-day-arrives-with-few-computer-glitches-worldwide/). | Sí, atribuido a la cobertura contemporánea. |
| 27 | El Senado resumió la controversia de costos diciendo que la falta de una catástrofe no permite medir el escenario que se evitó; su comité defendió como necesario el trabajo preventivo. | [Senate Special Committee, 29 feb. 2000](https://www.govinfo.gov/content/pkg/GOVPUB-Y1_3-PURL-LPS90964/pdf/GOVPUB-Y1_3-PURL-LPS90964.pdf), pp. 3–5. | Sí, como evaluación del comité, no verdad incuestionable. |
| 28 | Un artículo académico posterior señala que las medidas preventivas no pueden evaluarse por completo con el costo-beneficio convencional porque el contrafactual —qué habría pasado sin arreglos— no es observable. | [Robin Grove-White, “A precautionary tale”, *Futures* 34(1), 2002](https://www.sciencedirect.com/science/article/abs/pii/S0016328701000520). | Sí, para presentar el límite del debate. |
| 29 | Un artículo de 2001 revisa interrupciones menores y el gran costo preventivo; distingue que lo decisivo era la continuidad de servicios críticos, no que cada error desapareciera. | [Manion y Evan, “The Y2K problem and professional responsibility: a retrospective analysis”, 2001](https://www.sciencedirect.com/science/article/pii/S0160791X00000154). | Sí, como lectura retrospectiva, no fuente de cifras principales. |
| 30 | El caso clásico del problema de 2038 es un contador Unix de segundos almacenado en entero con signo de 32 bits, cuyo rango acaba el 19 de enero de 2038; POSIX exige `time_t` de al menos 64 bits en la edición 2024. | [Linux man-pages, `time(2)`](https://www.man7.org/linux/man-pages/man2/time.2.html); [POSIX.1-2024, Base Definitions rationale](https://pubs.opengroup.org/onlinepubs/9799919799/xrat/V4_xbd_chap01.html), edición 2024. | Sí, solo como caso acotado, no amenaza universal. |

### Mitos o datos dudosos que NO vamos a decir

- “No pasó nada”: falso; el GAO documentó fallas reales y acotadas.
- “Fue la estafa informática más grande”, “todo iba a colapsar” o “se evitó una catástrofe segura”: son conclusiones no probadas.
- No afirmar que el costo mundial fue exactamente 300, 400 o 580 mil millones; las estimaciones variaron en años, alcance y método.
- No atribuir automáticamente todos los cajeros japoneses detenidos el 29 de febrero al bug sin la reserva del ministerio; no afirmar que 1.200 cajeros afectaron a 1.200 personas.
- No repetir rumores de centrales nucleares, misiles, muertes o desastres. El informe del Senado advierte que su lista de incidentes no estaba toda verificada.
- No decir que Kiribati entero o una gran multitud fue la primera en celebrar. AP distinguió la normalmente deshabitada Millennium Island de Chatham, primer lugar permanentemente habitado.
- No sostener que “el año 2000 se guardaba siempre como 1900”; el comportamiento variaba según sistema y regla.
- No presentar la estimación de gasto como prueba automática de que cada dólar fue necesario o bien gastado.

### Cifras clave para visuales

- Dos dígitos: `99` → `00`; a cada sistema le tocaba interpretar la fecha.
- Millennium Island (UTC+14) → Chatham (UTC+13:45): **15 minutos**; Auckland entró después.
- U.S.: **US$100 mil millones** estimados por el Senado/Commerce; IDC Commerce modeló **US$114 mil millones** de gasto de software, EE. UU., 1995–2001; los ámbitos difieren.
- Mundo: **US$200 mil millones** en la aproximación de Koskinen frente a **US$320 mil millones** en IDC Project Magellan citado por el Senado. No sumar.
- Reino Unido: **£380 millones** de gobierno central.
- **175–200** personas en el Information Coordination Center; **~800** entre centros de FEMA, informe del Senado.
- Defensa: sistema satelital por debajo de capacidad plena; operación plena el **3 de enero**.
- Medicare: **50.475** reclamos mal fechados / **872** remitentes / **45** contratistas reportantes.
- FAA: **8** sitios con fechas incorrectas; el informe dice que no hubo impacto de seguridad/servicio/capacidad.
- Día bisiesto: hasta **1.200 de 25.000** cajeros postales reportados fuera; causalidad aún no establecida por el ministerio en el reporte contemporáneo.
- 2038: **19 de enero**, caso de `time_t` firmado de 32 bits; POSIX 2024 pide al menos 64 bits.

## 4. Título y gancho

- **Opciones de título:** A) ¿Fue el año 2000 la mayor estafa informática? B) El año 2000 llegó primero a una isla deshabitada C) Los programadores que volvieron para arreglar Y2K.
- **Título elegido para la apertura:** ¿Fue el año 2000 la mayor estafa informática?
- **Título visual inicial:** LA MEDIANOCHE CERO (se sustituirá por la miniatura elegida del paquete v2 al construirlo).
- **Antetítulo:** MILLENNIUM · 31 DIC 1999.
- **Primera frase:** “En la isla Millennium, en Kiribati, el año dos mil empezó mientras el resto esperaba.”
- **Bucle abierto:** si casi nada se rompió, ¿fue una alarma falsa o el resultado de años de arreglos?

## 5. Arco narrativo (curva de intensidad)

| acto | segmentos | intensidad | qué pasa | tono de voz |
|---|---|---:|---|---|
| Gancho/contexto | s01–s09 | 0.7–0.8 → 0.5 | Millennium entra en UTC+14; Chatham sigue 15 minutos después; por qué dos cifras podían producir fechas ambiguas. | intriga / claridad |
| Re-gancho 1 | s10–s18 | 0.55–0.75 | Cuánto cuesta la corrección y por qué las estimaciones de Estados Unidos, Reino Unido y el mundo no son intercambiables. | duda / asombro |
| Re-gancho 2 | s19–s27 | 0.45–0.85 | COBOL, programadores jubilados, planes de continuidad y equipos de guardia. | humano / tensión |
| Clímax | s28–s36 | 0.9–1.0 | Falla real en el procesamiento terrestre del sistema satelital, respaldo, recuperación y reportes de Medicare/FAA/día bisiesto. Pico cerca del 64%. | urgencia contenida |
| Cierre y reenganche | s37–s44 | 0.45–0.85 | Debate de proporcionalidad, límite del contrafactual y explicación acotada de 2038. | reflexivo / firme |

Re-enganche verbal y visual previsto cerca de 2:20, 4:40, 7:10, 9:20 y 11:30; los capítulos hablados están marcados en el guion en s01, s10, s19, s28 y s37, con aproximadamente 2–3 minutos entre inicios. Dos valles emocionales: costo y trabajo silencioso (4:30–6:00), y continuidad tras las fallas (9:30–11:00). El pico se ubica cerca del 64% del metraje.

## 6. Momentos de letra grande

| frase exacta del guion | por qué | palabra en acento |
|---|---|---|
| “DOS ÚLTIMOS DÍGITOS” | Resume el defecto de representación. | DÍGITOS |
| “QUINCE MINUTOS” | La diferencia concreta entre Millennium Island y Chatham. | QUINCE |
| “CIEN MIL MILLONES” | Escala de una estimación estadounidense. | MILLONES |
| “PROGRAMADORES COBOL” | Trabajo y experiencia de las personas que arreglaron código. | COBOL |
| “CAPACIDAD PLENA” | Contrasta la falla con el respaldo que conservó las funciones prioritarias. | PLENA |
| “NO HUBIERA PROBLEMA” | Responde a la falsa dicotomía de “nada pasó”. | PROBLEMA |
| “DOS MIL TREINTA Y OCHO” | Puente concreto, explicado con su límite técnico. | TREINTA Y OCHO |

## 7. Inventario visual y mapa visual

### 7a. Inventario visual

| objeto / mecanismo | planos que lo necesitan | ¿en el clímax? | componente existente | decisión |
|---|---|---|---|---|
| Calendario digital `99 → 00` y campo del año | origen, gancho y respuesta al título | Sí | no expresa la transición contextual de dos dígitos | crear `binary.y2kfield` |
| Reloj del Pacífico y cadena de husos | primera medianoche y seguimiento global | Sí | `binary.timeline` expresa tiempo lineal, no esta ruta geográfica | crear `binary.midnightrelay` |
| Sala de crisis, terminales y estados de sistema | guardias, clímax, contingencia | Sí | `binary.frame` muestra evidencia, no el estado cambiante de la guardia | crear `binary.crisisdesk` |
| Programa/registros COBOL y tarjetas impresas | costo humano y fechas mal interpretadas | No | foto + `binary.cipher` | usar componente + medio |
| Ticket de reclamo, panel FAA y respaldo satelital | incidencias documentadas | Sí | `binary.frame`, `binary.icon` (`globe`, `keyboard`) | catálogo + foto/rotulación contextual |

El pedido exige **tres componentes propios**; se crean tres para representar objetos únicos de la historia, aunque el mínimo base para 13 minutos sea menor.

### 7b. Mapa visual previsto

| seg | qué se dice | componente(s) | medio |
|---|---|---|---|
| s01–s03 | Millennium Island entra primero; Chatham sigue 15 minutos después | `binary.title`, `binary.midnightrelay` | Vista orbital de Kiribati, rotulada como ilustrativa |
| s04–s11 | Fecha de dos dígitos y ambigüedad de `00` | `binary.y2kfield`, `binary.cipher` | terminal y campo de año |
| s12–s18 | Por qué el esfuerzo costó cientos de miles de millones; distintos cálculos | `binary.y2kfield`, `binary.chart`, `binary.counter`, `binary.versus` | mainframe y estimaciones |
| s19–s23 | COBOL, programadores recontratados y continuidad | `binary.crisisdesk`, `binary.cipher`, `binary.frame` | terminal y código |
| s24–s30 | Equipos de guardia y falla terrestre del sistema satelital | `binary.midnightrelay`, `binary.crisisdesk`, `binary.frame`, `binary.icon` (`globe`) | Vista orbital de Kiribati y sala ilustrativa |
| s31–s35 | Medicare, FAA y los límites del registro de incidentes | `binary.y2kfield`, `binary.icon` (`keyboard`, `bell`) | formulario y consola meteorológica, ilustrativos |
| s36–s39 | Día bisiesto, escalas y debate de proporcionalidad | `binary.timeline`, `binary.versus`, `binary.icon` (`question`) | cronología y dilema de costo |
| s40–s44 | 2038 explicado y respuesta al título | `binary.icon` (`clock`), `binary.y2kfield`, `binary.title` | reloj y campo de fecha |

## 8. Medios necesarios

Se buscarán en Wikimedia Commons, con licencia libre y crédito en `assets/media/CREDITS.md`; fotos ilustrativas se rotulan como tales y no como fotografías de la sala real del Senado/DoD.

| archivo | qué mostrar | búsqueda sugerida | escena |
|---|---|---|---|
| kiribati-iss.jpg | atolón de Kiribati visto desde órbita | `ISS View of Kiribati` | primera medianoche; ilustrativo del archipiélago |
| y2k-date-error.jpg | monitor que muestra “3 janvier 1900” | `Y2K bug date display` | origen del error, captura Wikimedia |
| terminal-vt100.jpg | terminal DEC de texto | `DEC VT100 terminal` | programas heredados; foto de un terminal distinto, no un equipo de 1999 |
| community-terminal.jpg | terminal comunitaria de época | `Community Memory Terminal` | memoria y compatibilidad; ilustrativa |
| cobol-poster.jpg | afiche de curso de COBOL de 1969 | `COBOL poster 1969` | personas y código; ilustrativo |
| cobol-program.jpg | hoja de programa COBOL | `COBOL programa informatico` | líneas de código; documento ilustrativo |
| cobol-tape.jpg | cinta de compilador COBOL para Univac | `Cobol Compiler for Univac` | sistemas antiguos; objeto de museo |
| computer-room.jpg | sala de cómputo con terminales | `Informatics computer room` | equipos de guardia; ilustrativa, no la sala real del Senado/DoD |
| y2k-kvm-switch.jpg | switch con etiqueta “Y2K compliant” | `KVM Switch Y2K` | preparación concreta; fecha del objeto no atribuida |
| y2k-rollover-bangalore.jpg | calle de Bangalore el 1 ene. 2000 | `In the wake of Y2K` | aftermath; foto de la mañana posterior, no un registro del evento en una sala de control |

## 9. Publicación (se copia a `publish.json`)

- **Títulos YouTube A/B/C:** ver estrategia y paquete v2 en `publish.json`.
- **Descripción:** nueve bloques generados por el paquete: gancho, contexto, capítulos, reflexión, pregunta, agradecimiento, fuentes, créditos de imágenes y hashtags.
- **Tags:** historia Y2K, año 2000, problema informático del año 2000, COBOL, historia de la informática, medianoche de 1999, Kiribati, Nueva Zelanda, software, errores de fecha, ingeniería de software, NodeHistory.
- **Miniaturas:** texto-only “EL MUNDO ESPERÓ / SIN SABER POR QUÉ”; alternativa con imagen del error de fecha y texto “SE VOLVIÓ RETRO”.
- **Comentario fijado:** dato verificable del horario de Chatham y dos preguntas abiertas.

## 10. Riesgos y verificación

- **Respeto:** no se atribuyen muertes, víctimas ni daños que las fuentes no documenten. La única falla de alto interés se presenta junto a la reducción de capacidad, respaldo y fecha de recuperación.
- **Cifras revisadas en más de una fuente:** gasto de EE. UU. (~US$100b: Senado + Comercio; federal US$8.34b/8.5b: Senado + Koskinen), UK £380m (dos respuestas Hansard), fallas de día bisiesto (AP + Bloomberg/LA Times para cajeros), y husos del Pacífico (AP contemporánea + registro histórico IANA/timeanddate; diez de la mañana en Greenwich es un cálculo derivado de UTC+14).
- **Debate:** se atribuye la defensa del gasto al Senado y a Koskinen; se explica que distintos modelos arrojan cifras diferentes y que el contrafactual es imposible de observar. La pregunta de proporcionalidad queda abierta a la evidencia.
- **Puente 2038:** explicado como riesgo de un formato de tiempo específico y limitado; POSIX 2024 ya exige `time_t` de al menos 64 bits. No se afirma que todos los dispositivos vayan a fallar.
- **Visuales:** los medios actuales se acreditarán por archivo, autor y licencia; toda imagen ilustrativa queda identificada como tal. La apertura final vendrá de la miniatura elegida al construir el paquete.
- **Componentes:** `binary.midnightrelay`, `binary.crisisdesk` y `binary.y2kfield` aprobaron el control sin errores estáticos o de navegador en tres rondas. Los avisos automáticos de anchura vertical de crisisdesk (46% del cuadro) y y2kfield (43%) quedan documentados y justificados en `work/components/review.md`; ambos usan la altura y la rúbrica los considera legibles para planos breves.
