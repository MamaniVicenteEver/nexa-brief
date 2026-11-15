# Brief: nueva plantilla NodeMotion (chat de estudio)

Fecha: 2026-11-15. Escrito para un chat nuevo de Claude Code dentro de nexa-brief. Léelo completo antes de hacer nada.

## 1. Contexto

- nexa-brief produce videos a partir de plantillas. NodeMotion es el motor de plantillas animadas para letras de canciones y promos.
- Cada plantilla tiene un diseño con su motor en `src/templates/_tools/nodemotion/<familia>/designs/<id>/` y una entrada delgada en `src/templates/nodemotion/<familia>/<id>/`. El catálogo público es `src/templates/templates.json`.
- Studio (la web) elige plantilla, sube canción y medios, previsualiza, prepara y graba. Previsualizar no usa IA. Preparar solo completa lo que falte.

## 2. Tu rol

- Estudiar una referencia de video que el usuario te pase (URL o archivo) y crear una plantilla NUEVA inspirada en ella.
- La referencia es una guía, no algo que copiar. Parte de una base aprobada del repo, adáptala a la canción, el texto y el tiempo pedidos, y crea tus propios componentes.
- Este primer chat es solo de estudio y análisis. No construyas nada hasta que el usuario pase la referencia concreta. Entonces construye con la skill `nuevo-prototipo`.
- Modelos: Haiku 5.5 con esfuerzo alto para este estudio. Para construir, Sonnet 5.5. Opus 5.5 solo para revisar el resultado visual o un corte difícil. Codex no tiene cuota hasta el 20/11/2026.

## 3. Reglas

- Nada de copiar literal ni de mezclar dos diseños. Declara la base en `REPORT.md`.
- Nombres únicos. `id` y `display_name` deben ser únicos en `templates.json`, sin contar mayúsculas ni espacios. Convención: el id es `<familia>-<cambio>`; el nombre visible comparte la base de la familia y termina con la palabra del cambio. El cargador rechaza duplicados (`assert_unique_display_names` en `src/config/template_manifest.py`).
- Ubicación: los prototipos y pruebas van en `$NEXA_PROFILE_DIR/sandbox/<categoría>/<id>/`, no en `src/templates/`. `src/templates/sandbox/` solo admite motores experimentales compartidos. Una demo pasa a producción solo con el servicio «Pasar a producción» (`nexa-brief-server/docs/pasar-a-produccion-disenos.md`).
- No renderizar, publicar, hacer commit ni push sin autorización explícita.
- No borrar videos de prueba: déjalos en preparación y avisa al usuario.
- Música y videos de referencia tienen copyright: solo comparación interna. Cada video lleva `licencias.json` y `LICENCIAS.md`.
- No imprimir `.env`, contraseñas, tokens ni la contraseña del backup.
- Sin emojis en la interfaz ni en los textos.
- Informe final: `PLANTILLA-INFORME.md`, como indica `nexa-brief-server/src/skills/ORQUESTACION.md` (sección 5).
- Responde al usuario en español. Tu razonamiento interno puede ser en inglés.

## 4. Lectura (solo lo necesario, en este orden)

0. Reglas generales: `nexa-brief/AGENTS.md` (perfil activo, sandbox y respaldos), `nexa-brief-server/src/skills/README.md`, `nexa-brief-server/src/skills/CALIDAD.md` (estándar obligatorio) y `nexa-brief-server/src/skills/ORQUESTACION.md` (roles, delegación e informe).
1. `src/templates/_tools/nodemotion/AGENTS.md` y `docs/nodemotion-template-authoring.md` (reglas, contratos y criterios de aceptación).
2. `docs/nodemotion-architecture.md` y `docs/nodemotion-validation.md` (límites medidos).
3. Base de letras más cercana: `src/templates/_tools/nodemotion/lyrics/designs/lyrics-grunge/` (QUICK.md, manifest.json, document.html, scripts/, styles/).
4. Entrada de la plantilla en `src/templates/templates.json` y `src/templates/nodemotion/lyrics/<id>/` (index.html, assets/config.json).
5. Grabación: `src/adapters/recorder/infrastructure/hyperframes_adapter.py` y el adaptador de Playwright en la misma carpeta.

## 5. Estado al 15/11/2026

- Hay dos plantillas de letras con base de nombre "Grunge Rojo": `lyrics-grunge` (nombre visible "Grunge Rojo", la original) y `lyrics-grunge-rojo` (nombre visible "Grunge Rojo Glitch", mezcla de una referencia con la original). El usuario dice que el resultado está bien, pero no es lo que pidió. Pendiente: decidir si se rehace. El ID no se renombró.
- Aplicado en el servidor, sin commit: nombre único y validación en el cargador (activa desde las 13:01 UTC); reglas de referencias y nombres en AGENTS.md y en la guía de autoría.
- Motor de grabación: Studio fuerza HyperFrames; el nicho stylish-kinetic usa Playwright por defecto. Sin pausas: HyperFrames tarda 267 s y Playwright 223 s para 179 s de video.
- Comparación de los dos motores con la misma canción y configuración: Playwright va atrasado unos 0,25 s de forma constante, y aun alineado difiere unos 12 de 255 en promedio. Dos renders de HyperFrames del mismo proyecto difieren 0,1 de 255. Pendiente: confirmar a simple vista si la diferencia se nota. Comparación lado a lado: `/home/university/Descargas/comparacion-hyperframes-playwright/index.html` (script `metricas.py`, misma carpeta).
- Una grabación de HyperFrames con IA (trabajo ac52c620) tardó 784 s, pero su video es prácticamente igual al de la otra ejecución (0,1 de 255): la pausa fue al cerrar el proceso, no en el contenido. Sin causa confirmada. No hubo llamadas a IA durante el render.

## 6. Servidor y herramientas

- Servidor: `ssh alfred-server`. Repo: `/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server/`.
- API en `127.0.0.1:8000` con uvicorn `--reload` (recarga al cambiar archivos de `src/`, salvo `src/templates/`). Studio en `192.168.20.12:3000`.
- Datos del perfil: `~/.local/share/nexa-brief/profiles/profesional/`. Trabajos en `logs/jobs/<id>/`; renders en `renders/videos/nodemotion/<id>/`.
- Si el servidor está saturado, renderiza y revisa en la máquina local; TTS e image_gen se quedan en el servidor.
- Propuesta pendiente, no aprobada: herramientas pequeñas y probadas (captura de un cuadro en el segundo t, revisión de tiempos de letras, comparación de renders) dentro de `src/skills/`, junto a CALIDAD y ORQUESTACION. No crear un segundo motor.

## 7. Primer entregable (antes de construir)

Crea `docs/investigaciones/ANALISIS-<id>.md` con:

- Lo que entendiste de la referencia, en segundos: escenas, tipografía, color, movimiento, transiciones, cortes y silencios.
- Qué base del repo sirve y por qué; qué falta.
- Riesgos: sincronía de letras, motor de grabación, licencias.
- Plan por tareas, con el modelo recomendado para cada una.
- Preguntas que necesitas que responda el usuario.

Después, espera la URL o el archivo de la referencia concreta.
