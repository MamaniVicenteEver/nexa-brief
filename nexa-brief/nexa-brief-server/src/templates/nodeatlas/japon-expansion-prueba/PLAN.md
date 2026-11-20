# Expansión del Imperio japonés · NodeAtlas

## 1. Alcance
Video terminado de aproximadamente dos minutos, promovido a NodeAtlas por pedido del usuario el 2026-11-02. Diseño compartido Imperio. Se conserva la voz, el mapa, sus movimientos, el storyboard continuo y la mezcla de efectos aprobada.

## 2. Enfoque editorial
Explicar la expansión de 1868 a 1942 mediante mapas. Tono documental y neutral: distinguir anexión, ocupación, mandato e influencia. China no se presenta conquistada en su totalidad. Las flechas muestran dirección; los polígonos son aproximaciones explicativas. No se pretende contar la derrota posterior.

## 3. Hechos y fuentes
Fuentes primarias, archivos y museos consultados el 2026-11-02. Paráfrasis; no hay citas reconstruidas.

| n | fecha | hecho respaldado | fuente |
|---|---|---|---|
| 1 | 1868 | Restauración Meiji e inicio de la transformación del Estado japonés. | https://www.ndl.go.jp/modern/e/utility/chronology.html |
| 2 | 1895 | Shimonoseki: cesión de Taiwán y Pescadores tras la guerra sino-japonesa. | https://archives.ith.sinica.edu.tw/collections_con2_en.php?no=175 |
| 3 | 1905 | Portsmouth: Sajalín sur y reconocimiento de la presencia japonesa en Corea y Manchuria meridional. | https://history.state.gov/milestones/1899-1913/portsmouth-treaty |
| 4 | 1910 | Anexión de Corea: tratado firmado y promulgado en agosto. | https://history.state.gov/historicaldocuments/frus1910/d705 |
| 5 | 1914–1920 | Ocupación de islas alemanas al norte del ecuador y posterior mandato de la Sociedad de Naciones. | https://www.jacar.go.jp/exhibition/glossary/gaichitonaichi/table/history3.html |
| 6 | 1931–1932 | Ocupación de Manchuria y establecimiento de Manchukuo bajo control japonés. | https://history.state.gov/milestones/1921-1936/mukden-incident |
| 7 | 1937 | Guerra a gran escala con China; avances por la costa no equivalen al control de todo el país. | https://history.state.gov/milestones/1937-1945/pearl-harbor |
| 8 | 1940–1941 | Entrada en Indochina y giro hacia el sur, en el contexto de las restricciones de suministros. | https://history.state.gov/milestones/1937-1945/pearl-harbor |
| 9 | 1941 | Pearl Harbor, Hong Kong, Malaya y Filipinas forman parte de las ofensivas de diciembre. | https://www.nam.ac.uk/explore/far-east-campaign |
| 10 | 1941 | Guam cae en diciembre; fuente del National Park Service. | https://home.nps.gov/articles/guamwwii.htm |
| 11 | 1941 | Wake es capturada el 23 de diciembre; documentación histórica federal. | https://tile.loc.gov/storage-services/master/pnp/habshaer/um/um0000/um0061/data/um0061data.pdf |
| 12 | 1942 | Avances sobre Singapur, Indias Orientales Neerlandesas y Birmania en los primeros meses del año. | https://www.nam.ac.uk/explore/far-east-campaign |
| 13 | 1941–1942 | Interés estratégico por petróleo, caucho y estaño de las Indias Orientales; informe diplomático contemporáneo. | https://history.state.gov/historicaldocuments/frus1941v04/d697 |
| 14 | 1942 | Máxima extensión a mediados del año; distinguir dominio territorial, enclaves y avances militares. | https://anzacportal.dva.gov.au/resources/japanese-thrust-map |
| 15 | 1942 | La expansión alcanza las Aleutianas; ocupación de Attu y Kiska. | https://home.nps.gov/articles/wwii-nhl-aleu-campaign.htm |

## 4. Guion y voz
Se conserva el texto narrado: 13 segmentos y 254 palabras. Audio existente de 120,12 segundos, voz Charon y mezcla seleccionada en config.audio.src. Se añaden capítulos como metadatos, sin regenerar la voz. El perfil short_map permite validar el formato de dos minutos sin cambiar los rangos de los videos largos.

## 5. Dirección visual
Cinco beats: apertura nativa, archivo, dos rótulos y una campaña continua. La campaña incluye 22 destinos con anclas narradas, 8 posiciones de cámara y 5 apoyos documentales. El control cuenta hitos narrados distintos; no se introducen cortes artificiales. Las miniaturas A/B/C se capturan aparte y preserve_opening mantiene la apertura aprobada.

## 6. Componentes propios
imperio.campaign e imperio.footage permanecen en assets/components/japon.js con su catálogo y revisión. Al entrar a producción pueden descubrirse con kit.py library y reutilizarse en nuevos videos compatibles. No se duplica el motor.

## 7. Medios y licencias
Créditos completos en assets/media/CREDITS.md y publish.json. La bandera es stock moderno. Los archivos de Java son ilustrativos y se identifican por su procedencia; no se atribuyen a Pearl Harbor ni a otro combate. No se necesita agregar esos clips ausentes para describir el mapa aprobado. Los sonidos de biblioteca no se presentan como registro histórico auténtico.

## 8. Paquete de publicación
publish.json v2 contiene títulos A/B/C, miniaturas A/B/C, descripción, capítulos, reflexión, fuentes, créditos, etiquetas de YouTube y hashtags por plataforma, textos de Facebook y TikTok y comentario fijado. Se usan las estrategias activas por defecto con el perfil NodeAtlas. No se publica ni se graba desde este trabajo.

## 9. Verificación
Validar check, manifest y publishing check; revisar portada y miniaturas en 16:9 y 9:16. Conservación de audio y storyboard contrastada con hashes previos en el respaldo externo de esta tarea. Neutralidad revisada: verbos de hechos, sin glorificación ni afirmación de control de toda China.

## 10. Límites documentados
El esquema cartográfico no es catastral. La finalidad del cierre en 1942 es mostrar el alcance de la expansión, no explicar toda la guerra. El usuario conserva la decisión de grabar y publicar. Los resultados de validación prescindibles se guardan en work/results/ ignorado por Git.
