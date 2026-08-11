# html-templates — plantillas visuales del pipeline NEXA BRIEF

Todo el trabajo de plantillas HTML/CSS/JS (composiciones seamless, lyric videos,
prospectos) con sus estudios, prompts de replicación y assets de prueba.
Cada plantilla es un solo archivo HTML autocontenido gobernado por un `CONFIG`
al inicio del script — para reutilizarla con otra canción/imagen solo se cambia
el CONFIG, nunca el motor.

## Estructura

| Carpeta | Contenido |
|---|---|
| `lyric-videos/` | **Plantillas de letras sincronizadas** (las 5 activas) + `transcribe.py` (audio → JSON con timestamps por palabra) + letras generadas + audios de prueba. Ver su `README.md` propio para el uso de transcribe. |
| `seamless/` | Serie del **motor seamless** (la imagen/video se funde con la página): `in*.html` (v5→v9: regiones, blur, video, captura única, rotación/letterbox) + todos los assets de prueba (`bg*`, `test*`, `video-split.mp4`). |
| `prospect-templates/` | Plantillas construidas desde los prospectos: `p1-escena` (Escena Viva), `p4-aura` / `p4-aura-split` (AURA dual), `pt-edicion` (La Edición hype). |
| `prototypes/` | Prototipos originales de exploración (los 14 analizados en el ranking de prospects). |
| `docs/` | **Estudios completos**: ESTUDIO-COMPLETO (base v5/v6), FONDOS-COMPLEJOS (v7), VIDEO (v8), CAPTURA-UNICA (v9), prompts v5/v6. |
| `docs/prospects/` | Ranking de los 14 prototipos + PROSPECTO-1..5 + DOPAMINA / ADRENALINA / TOTAL + prompts de replicación P1/P4/PT. |

## Las 5 plantillas de letras (lyric-videos/)

| Plantilla | Género / estilo | Mecánica |
|---|---|---|
| `neon-letras-V3.html` | Neón urbano (ref. "Hola Remix") | Letreros de tubo que se encienden palabra a palabra, grada de columnas, cámara que deriva en 3 direcciones |
| `letras-suave.html` | Suave / pop | Columna vertical calma, blanco impacto + rojo marcador, entradas variadas, fondo filtrado |
| `letras-romantica-V1.html` | Romántica | "Carta a mano": se escribe carácter a carácter, serif itálica + caligrafía con latido, bokeh cálido |
| `letras-triste-V1.html` | Triste | Frío azul, lluvia en canvas, palabras que caen y se hunden, typewriter que parpadea |
| `letras-impacto-V1.html` | Impacto / corrido-urbano (ref. AGUAS) | Frases que SE ARMAN palabra a palabra a estampa, una gigante + chicas alrededor, todo rojo, golpe y sacudida |

Todas: letra 100% desde JSON de Whisper (`lyricsUrl`), reloj sincronizado al
audio real, intro + outro propios (el outro dispara por el final real del
audio), fondo imagen/video con filtro por CONFIG, HUD de debug removible,
semilla determinista, y **responsive móvil sin afectar desktop**.

## Cómo correr

Servir por HTTP (el `fetch` de las letras no funciona con `file://`):
Live Server sobre la carpeta del proyecto, o `python -m http.server` dentro de
la subcarpeta. Click para iniciar el audio.

## Nota sobre rutas

Los HTML referencian sus assets en su MISMA carpeta, salvo dos casos ya
apuntados a rutas relativas: `prospect-templates/p4-aura*.html` →
`../prototypes/6.png` y `prospect-templates/pt-edicion.html` →
`../seamless/test2.mp4`. Si mueves archivos de carpeta, revisa esos `src`.
El entorno `lyric-videos/.venv` siguió funcionando tras el traslado
(verificado); si algún día falla, se recrea con `uv venv && uv pip install
faster-whisper` dentro de `lyric-videos/`.
