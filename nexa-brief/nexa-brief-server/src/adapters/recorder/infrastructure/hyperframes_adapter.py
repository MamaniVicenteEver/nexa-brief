"""HyperFrames adapter — renderiza vía el CLI `hyperframes` (Node), como
subproceso, mismo patrón que RemotionAdapter (ver remotion_adapter.py).

Motor alternativo seleccionable por niche (ver factory.py). Por ahora solo
"01-image-bg" (niche image_bg_portrait) tiene una composición HyperFrames
real portada — nexa-brief-hyperframes/src/image-bg-portrait/, a partir de
src/templates/IMG-retrato-impacto/index.html. Cualquier otro niche sigue sin
soporte: supports_niche() devuelve False y el router rechaza con 400 antes
de llegar a record(), igual que ya hace con Remotion para un niche sin
portar (ver _COMPOSITION_BY_TEMPLATE_ID).

El mecanismo de contenido dinámico está validado con un render real (spike
2026-09-17, ver docs/investigaciones/hyperframes-en-nichos-y-selector-ui.md
sección 3) y también con el pipeline completo (config real + imagen de fondo
real + audio real + ecualizador precalculado, todo vía el CLI instalado —
hyperframes v0.8.3): el CLI soporta `--variables-file` en `render` LOCAL (no
solo en `lambda render`), leído en la composición vía
`window.__hyperframes.getVariables()`. record() arma un directorio efímero
por job (copia de la composición + assets reales + duración sustituida en el
HTML estático — `data-duration` NO se puede mutar en runtime, confirmado con
spike) antes de invocar el CLI, mismo espíritu que RemotionAdapter con
_remotion_props.json pero con un paso extra porque HyperFrames resuelve
rutas relativas contra su propio directorio, no contra output_dir.

Dónde corre el render es seleccionable vía settings.hyperframes_render_target
("local" | "aws"), sin tocar código — "local" invoca `hyperframes render`
como subproceso en esta máquina; "aws" invoca `hyperframes lambda render`
contra el stack ya desplegado (ver nexa-brief-hyperframes/aws/README.md) y
descarga el resultado con `aws s3 cp` (shell-out, igual que el resto de este
adapter — este backend no tiene un SDK de AWS nativo en Python, ver
remotion_adapter.py: ese motor tampoco lo usa, delega todo a Node).
"""

from __future__ import annotations

import asyncio
import json
import re
import shutil
from pathlib import Path
from typing import TYPE_CHECKING

import structlog

from src.adapters.recorder.infrastructure.hyperframes_audio import compute_equalizer_magnitudes
from src.config.exceptions import RecordingError
from src.config.settings import settings
from src.adapters.recorder.infrastructure.subprocess_progress import parse_percent, run_with_progress
from src.config.template_manifest import get_template_paths
from src.core.ports.recorder_port import RecorderPort, RecordingResult
from src.core.progress import report_step_progress

if TYPE_CHECKING:
    from src.config.niche_config import NicheConfig

logger = structlog.get_logger(__name__)

# Frame rate fijo de las composiciones portadas (declarado también como
# data-fps en su HTML) — sin variante configurable todavía, ver settings.py.
_FPS = 30

# template_id (niche_cfg.template.template_id) -> directorio de la composición
# HyperFrames, relativo a settings.hyperframes_project_dir. "01-image-bg" ->
# src/image-bg-portrait, portado y probado 2026-09-17 (ver
# docs/investigaciones/hyperframes-en-nichos-y-selector-ui.md) a partir de
# src/templates/IMG-retrato-impacto/index.html (nexa-brief-server) — mismo
# motor de layout, ecualizador reemplazado por magnitudes precalculadas
# (ver hyperframes_audio.py). Agregar acá cuando se porte otra composición.
_COMPOSITION_BY_TEMPLATE_ID: dict[str, str] = {
    "01-image-bg": "src/image-bg-portrait",
}

# Límite de renders HyperFrames simultáneos en todo el servidor — separado del
# semáforo de Remotion y del de Playwright (ver settings.hyperframes_max_concurrent_renders).
_semaphore: asyncio.Semaphore | None = None


def _get_render_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(settings.hyperframes_max_concurrent_renders)
    return _semaphore


def _resolve_composition_dir(niche_cfg: "NicheConfig") -> Path | None:
    """`None` si el niche todavía no tiene una composición HyperFrames portada."""
    rel = _COMPOSITION_BY_TEMPLATE_ID.get(niche_cfg.template.template_id)
    if rel is None:
        return None
    return settings.hyperframes_project_dir / rel


def _resolve_template_dir(niche_cfg: "NicheConfig") -> Path | None:
    """Directorio de la plantilla HTML cruda (src/templates/<folder>/).
    Fallback genérico cuando no hay composición portada en _COMPOSITION_BY_TEMPLATE_ID."""
    paths = get_template_paths(niche_cfg.template.template_id)
    index_html = paths.get("index_html")
    return index_html.parent if index_html and index_html.exists() else None


def supports_niche(niche_cfg: "NicheConfig") -> bool:
    """Niches con composición portada (_COMPOSITION_BY_TEMPLATE_ID) → path optimizado.

    El path genérico (index.html de la plantilla directo) solo se ofrece para
    plantillas SIN letra sincronizada: las de letras animan con su propio
    reloj (audio.currentTime / requestAnimationFrame), que la captura cuadro a
    cuadro de HyperFrames no controla — probado 2026-09-25 con lyrics-romantic:
    la letra salía varios segundos atrasada respecto del audio. Para ofrecer
    HyperFrames en un nicho de letras hay que portar su composición."""
    if _resolve_composition_dir(niche_cfg) is not None:
        return True
    if niche_cfg.template.requires_lyrics:
        return False
    return _resolve_template_dir(niche_cfg) is not None


def _hyperframes_bin() -> Path:
    # node_modules/.bin/hyperframes directo, nunca `npx` — mismo motivo que
    # documenta nexa-render (overhead medido ~170s en su POC con npx).
    return settings.hyperframes_project_dir / "node_modules" / ".bin" / "hyperframes"


class HyperframesAdapter(RecorderPort):
    """Invoca el CLI `hyperframes` (nexa-brief-hyperframes) como subproceso Node."""

    async def record(
        self,
        html_path: Path,
        audio_path: Path,
        output_dir: Path,
        duration_seconds: int,
        niche_cfg: "NicheConfig | None" = None,
        render_target: str | None = None,
    ) -> RecordingResult:
        effective_render_target = render_target or settings.hyperframes_render_target
        if niche_cfg is None:
            raise RecordingError("HyperframesAdapter requiere niche_cfg (necesita template.template_id).")

        composition_dir = _resolve_composition_dir(niche_cfg)
        use_generic = composition_dir is None

        bin_path = _hyperframes_bin()
        if not bin_path.exists():
            raise RecordingError(
                f"HyperframesAdapter: no se encontró el binario en {bin_path} — "
                "¿corrió `npm install` en nexa-brief-hyperframes?"
            )

        video_format = niche_cfg.get_16x9_format()
        output_filename = video_format.output_filename if video_format else "youtube_video.mp4"
        youtube_path = output_dir / output_filename

        job_id = output_dir.name

        config_path = output_dir / "config.json"
        bg_source = output_dir / niche_cfg.template.media_src_filename
        if not bg_source.exists():
            raise RecordingError(f"HyperframesAdapter: falta la imagen de fondo {bg_source}.")

        bg_filename = bg_source.name
        audio_filename = audio_path.name

        site_dir = output_dir / "_hyperframes_site"
        if site_dir.exists():
            shutil.rmtree(site_dir)

        if use_generic:
            # ── Path genérico: usa el index.html de src/templates/ directo ──────
            # Funciona para TODAS las plantillas sin necesidad de portarlas a una
            # composición HyperFrames dedicada. data-duration y data-fps se
            # inyectan en el <html> como texto; los src de media se ajustan al
            # nombre real del archivo copiado. El EQ usa WebAudio en tiempo real
            # (headless = barras silenciosas); para EQ precalculado hay que portar
            # la composición y añadirla a _COMPOSITION_BY_TEMPLATE_ID.
            template_dir = _resolve_template_dir(niche_cfg)
            if template_dir is None:
                raise RecordingError(
                    f"HyperframesAdapter: no hay index.html para "
                    f"template_id={niche_cfg.template.template_id!r}."
                )
            shutil.copytree(template_dir, site_dir)

            shutil.copy(bg_source, site_dir / bg_filename)
            shutil.copy(audio_path, site_dir / audio_filename)
            if config_path.exists():
                shutil.copy(config_path, site_dir / "config.json")
            # Datos del job que la plantilla pide por fetch() relativo — sin
            # lyrics.json, loadLyrics() devuelve [] y el video sale sin letra.
            for data_file in ("lyrics.json", "manifest.json"):
                if (output_dir / data_file).exists():
                    shutil.copy(output_dir / data_file, site_dir / data_file)

            index_path = site_dir / "index.html"
            html = index_path.read_text(encoding="utf-8")
            # HyperFrames toma tamaño/duración del elemento raíz con
            # data-composition-id + data-width/height (ver htmlBundler de
            # @hyperframes/core); sin eso renderiza en su default vertical.
            # Se usa <body> como raíz: la plantilla ocupa toda la ventana.
            width = video_format.width if video_format else 1920
            height = video_format.height if video_format else 1080
            html = re.sub(
                r"(<body\b[^>]*?)>",
                f'\\1 data-composition-id="root" data-start="0" data-width="{width}" '
                f'data-height="{height}" data-duration="{duration_seconds}" data-fps="{_FPS}">',
                html,
                count=1,
            )
            # Ajustar src de audio (la plantilla declara song.mp3)
            html = html.replace('src="song.mp3"', f'src="{audio_filename}"')
            # Pasar ?headless=1 al audio para suprimir el botón de grabación
            # (el botón ya se oculta vía CSS cuando body tiene clase headless,
            #  que initRecUI() añade al detectar el parámetro en la URL)
            index_path.write_text(html, encoding="utf-8")

            variables: dict = {}
            variables_path = site_dir / "_hyperframes_variables.json"
            variables_path.write_text(json.dumps(variables), encoding="utf-8")

        else:
            # ── Path portado: composición HyperFrames dedicada ───────────────────
            # data-duration y los src de <img>/<audio> se sustituyen como texto
            # plano en el HTML estático, NO vía variables en runtime — confirmado
            # con spikes (ver docstring del módulo): el "compile" del CLI (fonts,
            # descubrimiento de assets de media) lee el HTML tal cual está en
            # disco, antes de que corra ningún script. `getVariables()` en
            # runtime sí funciona para CONTENIDO (texto/colores/arrays — no
            # requieren pre-extracción), pero no para qué archivo es cada media.
            shutil.copytree(composition_dir, site_dir)

            shutil.copy(bg_source, site_dir / bg_filename)
            shutil.copy(audio_path, site_dir / audio_filename)

            if not config_path.exists():
                raise RecordingError(
                    f"HyperframesAdapter: falta config.json en {output_dir} "
                    "(¿corrió html_generator antes de este stage?)."
                )

            index_path = site_dir / "index.html"
            index_path.write_text(
                index_path.read_text(encoding="utf-8")
                .replace("{{DURATION}}", str(duration_seconds))
                .replace("{{BG_SRC}}", bg_filename)
                .replace("{{AUDIO_SRC}}", audio_filename),
                encoding="utf-8",
            )

            # Ecualizador: magnitudes precalculadas por frame en vez de
            # AnalyserNode en vivo (ver hyperframes_audio.py) — mismo problema
            # que ya resolvió la versión Remotion de este template con
            # @remotion/media-utils, sin equivalente JS instalado acá.
            eq_magnitudes = compute_equalizer_magnitudes(audio_path, duration_seconds, fps=_FPS)

            variables = {
                "config": json.loads(config_path.read_text(encoding="utf-8")),
                "eqMagnitudes": eq_magnitudes,
            }
            variables_path = site_dir / "_hyperframes_variables.json"
            variables_path.write_text(json.dumps(variables), encoding="utf-8")

        if effective_render_target == "aws":
            if not settings.hyperframes_aws_stack_name:
                raise RecordingError(
                    "HyperframesAdapter: render_target='aws' pero falta "
                    "HYPERFRAMES_AWS_STACK_NAME — correr `hyperframes lambda deploy` primero "
                    "(ver nexa-brief-hyperframes/aws/README.md)."
                )
            if not settings.hyperframes_aws_bucket:
                raise RecordingError(
                    "HyperframesAdapter: render_target='aws' pero falta HYPERFRAMES_AWS_BUCKET "
                    "(nombre del bucket S3 del stack, ver Outputs de `hyperframes lambda deploy`)."
                )
            output_key = f"renders/nexa-brief/{job_id}/{output_filename}"
            cmd = [
                str(bin_path),
                "lambda",
                "render",
                ".",
                f"--stack-name={settings.hyperframes_aws_stack_name}",
                f"--region={settings.hyperframes_aws_region}",
                "--format=mp4",
                "--codec=h264",
                f"--chunk-size={settings.hyperframes_aws_chunk_size}",
                f"--max-parallel-chunks={settings.hyperframes_aws_max_parallel_chunks}",
                f"--execution-name={f'nexa-{job_id}'[:80]}",
                f"--output-key={output_key}",
                f"--variables-file={variables_path}",
                "--wait",
                "--json",
            ]
        else:
            output_key = None
            cmd = [
                str(bin_path),
                "render",
                ".",
                f"--output={youtube_path}",
                f"--workers={settings.hyperframes_workers}",
                f"--quality={settings.hyperframes_quality}",
                f"--variables-file={variables_path}",
            ]

        logger.info(
            "hyperframes_render_start",
            engine_target=effective_render_target,
            composition_dir=str(composition_dir),
            output=str(youtube_path),
            duration_seconds=duration_seconds,
        )

        try:
            report_step_progress(0.0)  # waiting for the render slot is not progress
            async with _get_render_semaphore():
                try:
                    result = await run_with_progress(
                        cmd,
                        cwd=site_dir,
                        timeout=settings.hyperframes_render_timeout_seconds,
                        parse_progress=parse_percent,
                    )
                except asyncio.TimeoutError:
                    raise RecordingError(
                        f"HyperFrames render timed out after {settings.hyperframes_render_timeout_seconds}s "
                        f"(site_dir={site_dir})"
                    )
        finally:
            shutil.rmtree(site_dir, ignore_errors=True)

        if result.returncode != 0:
            err = (result.stderr_tail or result.stdout_tail)[-500:] or "no output"
            logger.error("hyperframes_render_failed", returncode=result.returncode, stderr_tail=err)
            raise RecordingError(f"HyperFrames render failed (exit {result.returncode}): {err}")

        if effective_render_target == "aws":
            assert output_key is not None  # set unconditionally in the aws branch above
            await self._download_from_s3(output_key, youtube_path)

        if not youtube_path.exists():
            raise RecordingError(f"HyperFrames render exited 0 pero {youtube_path} no fue creado")

        logger.info("hyperframes_render_done", output=str(youtube_path))

        # Igual que RemotionAdapter: por ahora solo produce 16:9, el resto de
        # los formatos declarados en niches.json publican el mismo archivo vía
        # hardlink (packager exige un archivo físico por VideoFormat.output_filename).
        for fmt in niche_cfg.video.formats:
            fmt_path = output_dir / fmt.output_filename
            if fmt_path == youtube_path:
                continue
            fmt_path.unlink(missing_ok=True)
            fmt_path.hardlink_to(youtube_path)

        reels_format = niche_cfg.get_9x16_format()
        reels_path = (output_dir / reels_format.output_filename) if reels_format else youtube_path
        tiktok_path = reels_path if niche_cfg.video.generate_tiktok_clip else None

        return RecordingResult(
            youtube_path=youtube_path,
            reels_path=reels_path,
            tiktok_path=tiktok_path,
            stats={
                "engine": "hyperframes",
                "engine_target": effective_render_target,
                "composition_dir": str(composition_dir),
                "duration_seconds": duration_seconds,
            },
        )

    async def _download_from_s3(self, output_key: str, dest_path: Path) -> None:
        cmd = [
            "aws",
            "s3",
            "cp",
            f"s3://{settings.hyperframes_aws_bucket}/{output_key}",
            str(dest_path),
            f"--region={settings.hyperframes_aws_region}",
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            err = stderr.decode(errors="replace")[-500:] if stderr else "no stderr"
            raise RecordingError(f"HyperFrames: fallo al descargar resultado de S3 (exit {proc.returncode}): {err}")
