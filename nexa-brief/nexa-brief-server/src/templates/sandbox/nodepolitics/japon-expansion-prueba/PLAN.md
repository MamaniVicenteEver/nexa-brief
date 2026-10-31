# Expansión del Imperio japonés · prueba Desktop

## 1. Alcance

Prototipo horizontal para Sandbox, basado en los primeros treinta segundos del lenguaje visual de `nodepolitics/imperio-demo`: atlas físico azul grisáceo, foco carmesí en Japón, haces direccionales, rótulos breves y título condensado. El mapa avanza en sincronía con una narración española breve. No se graba ni publica un video.

## 2. Punto y enfoque

La expansión se cuenta como una secuencia concreta de anexiones, ocupaciones y campañas: Taiwán (1895), Corea (1910), Manchuria (1931–32), guerra en China (desde 1937) y avance por el Sudeste Asiático (1941–42). Los haces indican dirección de las campañas; no equivalen a fronteras ni ocupación completa. En especial, China no se muestra como conquistada.

## 3. Hechos y fuentes

- El Tratado de Shimonoseki, firmado en 1895 tras la guerra sino-japonesa, cedió Taiwán y las islas Pescadores a Japón. Fuente: [Taiwan Archives Online, Academia Sinica](https://archives.ith.sinica.edu.tw/collections_con2_en.php?no=175).
- Japón formalizó la anexión de Corea en 1910. Fuente primaria: [FRUS 1910, tratado de anexión de Corea](https://history.state.gov/historicaldocuments/frus1910/d705).
- El incidente de Mukden, el 18 de septiembre de 1931, precedió a la invasión japonesa de Manchuria; en 1932 se declaró Manchukuo, controlado por el ejército japonés. Fuente: [U.S. Office of the Historian, Mukden Incident](https://history.state.gov/milestones/1921-1936/mukden-incident).
- Los choques del puente Marco Polo en julio de 1937 dieron paso a una guerra a gran escala entre China y Japón. Fuente: [U.S. Office of the Historian, Japan, China, the United States and the Road to Pearl Harbor](https://history.state.gov/milestones/1937-1945/pearl-harbor).
- Japón lanzó una serie de ataques por el Pacífico y el Sudeste Asiático en 1941–42. Fuente: [Imperial War Museums, War and the British Commonwealth](https://www.iwm.org.uk/file-download/download/public/3421).

## 4. Guion

La expansión japonesa avanzó mediante anexiones, ocupaciones y guerras. En mil ochocientos noventa y cinco, el tratado de Shimonoseki cedió Taiwán a Japón. En mil novecientos diez, Japón anexó Corea. En mil novecientos treinta y uno, su ejército ocupó Manchuria; al año siguiente, instauró Manchukuo bajo control japonés. Desde mil novecientos treinta y siete, la guerra se extendió por China, pero Japón nunca conquistó todo el país. En mil novecientos cuarenta y uno y cuarenta y dos, sus fuerzas avanzaron por Malaya, Filipinas e Indias Orientales Neerlandesas.

## 5. Dirección visual

- Inicio: plano general hacia Japón y sol carmesí; una marca `🇯🇵 Japón` prueba si la vista del navegador representa correctamente la bandera emoji.
- 1895–1910: haces desde Japón a Taiwán y Corea, revelados al nombrar cada región.
- 1931–37: haces a Manchuria y al norte de China; las zonas se rotulan como campañas, sin rayar la silueta completa de China.
- 1941–42: abanico de rutas hacia Malaya, Filipinas e Indias Orientales Neerlandesas.
- Se reutilizan `imperio.title`, `imperio.map`, `imperio.expansion` e `imperio.word`. No se añade ni modifica código del motor.

## 6. Medios

- Una foto de dominio público muestra soldados del Ejército Imperial japonés saliendo de la estación de Okayama hacia el frente de Manchuria tras el Incidente de Mukden. El crédito y la fuente están anotados en `assets/media/CREDITS.md`; el plano se integra con `imperio.archive`.

## 7. Verificación

- `kit.py voice`: narración Charon; 121 ppm, WER aproximado 0,023, sin palabras faltantes. La diferencia detectada es solo normalización de “mil novecientos” frente a las fechas en cifra.
- `kit.py transcribe`: 67 palabras con tiempos reales, 50,24 s de pista total. El cierre del canal es visual/silencioso; no hay una toma vocal de outro disponible.
- `kit.py check`: OK, sin errores. Avisos conservados: título inicial de 11,8 s (para seguir la apertura del demo) y cero componentes `common.lyric` (las fechas y regiones se muestran en el atlas).
- Sandbox: comprobados playback y seek; a los 16 s se ven las banderas locales de Corea y Japón junto al subtítulo.
- No se renderizó ni publicó video.

Las banderas son SVG locales, fechadas para el actor o administración de cada etapa: bandera Qing y japonesa (1895), coreana imperial y japonesa (1910), Manchukuo (1932), República de China (1937), y británica, de la Mancomunidad Filipina y neerlandesa (1941–42). La tarjeta aparece según `audio.currentTime`, con tiempos tomados de `lyrics.json`; comprobar legibilidad y sincronía en Sandbox. El diseño `imperio` no tiene componente gráfico de banderas; su parámetro `flag` solo define colores del sol y los rayos.
