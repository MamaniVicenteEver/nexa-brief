Escribe la narración en off de un video documental animado de unos 2 minutos sobre el PRIMER DÍA DE LA
BATALLA DEL SOMME (1 de julio de 1916). La animación: figuras estilizadas vistas desde un dron, soldados
británicos (con los colores de la bandera del Reino Unido) que salen de su trinchera y avanzan caminando
hacia la línea alemana (colores de la bandera del Imperio alemán), donde esperan ametralladoras detrás del
alambre de púas. Caen en oleadas. Al final, pocos sobreviven escondidos en cráteres. Sobre el campo crecen amapolas.

USA SOLO ESTOS DATOS (verificados; no agregues cifras ni nombres que no estén acá):
- 1 de julio de 1916, en el río Somme, norte de Francia. Ataque principal británico (Cuarto Ejército).
- El bombardeo previo empezó el 24 de junio y duró una semana: más de un millón y medio de obuses.
- La idea: destruir el alambre de púas y las defensas alemanas, para que la infantería solo tuviera que caminar.
- Muchos obuses no explotaron (la carga explosiva se había deteriorado). En muchos tramos el alambre quedó entero.
- Los alemanes esperaron el bombardeo en refugios profundos, bajo tierra.
- A las siete y veintiocho estallaron las minas cavadas bajo las líneas alemanas (la de Hawthorn Ridge, a las siete y veinte).
- A las siete y media sonaron los silbatos y la infantería salió de las trincheras.
- Muchos batallones avanzaron caminando, despacio, en líneas. Algunos hombres cargaban unos treinta kilos de equipo.
- Cuando el bombardeo se levantó, los alemanes salieron de sus refugios y montaron las ametralladoras.
- En Beaumont-Hamel, el Regimiento de Terranova: unos setecientos ochenta hombres avanzaron; la mayoría murió en
  quince minutos; al día siguiente solo sesenta y ocho respondieron al pasar lista.
- Muchos heridos se escondieron en los cráteres de los obuses hasta que cayó la noche.
- Ese día el ejército británico tuvo cincuenta y siete mil cuatrocientas setenta bajas, diecinueve mil doscientos
  cuarenta muertos: las peores pérdidas de su historia.
- La batalla siguió hasta el dieciocho de noviembre. Más de un millón de hombres de todos los bandos murieron o
  quedaron heridos. Los aliados avanzaron unos diez kilómetros.
- La amapola roja es el símbolo con que se recuerda a los caídos de esa guerra.

ESTILO: documental sobrio y humano, español latinoamericano neutro, narración en segunda persona ocasional
("imagina…" está bien una vez), frases de 6 a 16 palabras, sin adjetivos de relleno, sin morbo, sin
citas inventadas. Respeto por los muertos. Números SIEMPRE en palabras.

PALABRAS ANCLA OBLIGATORIAS (sincronizan la animación con la voz). Deben aparecer EXACTAMENTE así (misma
forma, sin cambiar singular/plural), en ESTE ORDEN, y cada una UNA sola vez en todo el texto:
  "obuses" · "refugios" · "minas" · "silbatos" · "caminando" · "ametralladoras" · "Terranova" ·
  "cráteres" · "noche" · "noviembre" · "amapolas"
Además la primera oración debe empezar con "Uno de julio de mil novecientos dieciséis."

LARGO: entre 235 y 260 palabras en total.

Devuelve SOLO un objeto JSON:
{"segments": [{"id": "s01", "tone": "<tono>", "intensity": <0..1>, "text": "<texto>"}, ...]}
con 12 a 16 segmentos (uno por momento de la animación). "tone" debe ser uno de:
intriga, suspenso, explicativo, tensión, tensión creciente, peso, silencio, dolor contenido, duelo, revelación,
reflexivo, cierre. Curva: empieza en intriga, sube hasta el clímax (ametralladoras/Terranova, intensidad ~1),
baja a duelo y cierra reflexivo.
