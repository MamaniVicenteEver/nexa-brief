"""HyperFrames adapter — renderiza vía el CLI `hyperframes` (Node), como
subproceso, mismo patrón que RemotionAdapter (ver remotion_adapter.py).

Motor alternativo seleccionable por niche (ver factory.py). Por ahora solo
"01-image-bg" (niche image_bg_portrait) tiene una composición HyperFrames
real portada — nexa-brief-hyperframes/src/image-bg-portrait/, a partir de
src/templates/image/01-image-bg/index.html. Cualquier otro niche sigue sin
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
import time
from dataclasses import dataclass
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
# src/templates/image/01-image-bg/index.html (nexa-brief-server) — mismo
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


# Plantillas de letras validadas en el path genérico con el reloj
# determinístico nb-hf-clock (src/templates/_tools/hyperframes/): cada una se
# renderizó en 16:9 y 9:16 y se comparó cuadro a cuadro contra el navegador
# (Playwright) al mismo t — ver docs/investigaciones/hyperframes-optimizacion-2026-10.md.
# Una plantilla de letras que NO está acá sigue sin HyperFrames: su letra
# depende del reloj de la página y sin validar no se sabe si sale en sincronía.
# Para sumar una: `python src/templates/_tools/hyperframes/optimize.py <id>`,
# validar (mismo doc, sección "Cómo validar una plantilla nueva") y agregarla.
# lyrics-neon: validada 2026-10-03 con su contenido por defecto, 30 s, 16:9 y
# 9:16 (output/hf-demo-lyrics-neon/): letra en sincronía en 5/12/20/28 s.
# 2026-10-04 (render_demo.py, 30 s, 16:9 y 9:16, cuadros vs lyrics.json):
# amor-impredecible, caution, collage, cristal, expediente — ver output/hf-demo-<id>/.
# 2026-10-05: lyrics-mixtas — 30 s, 16:9 y 9:16, letra sincronizada y fondo en movimiento.
# 2026-10-05: ceniza, lluvia-gris, memoria, vacio — 30 s, 16:9 y 9:16,
# letra sincronizada, audio y fondo en movimiento.
# 2026-10-05: promo-sports, promo-trendy, promo-urban — 30 s, 16:9 y 9:16,
# CTA/letra legible y fondo en movimiento.
# 2026-10-05: promo-editorial — aprobada por revisión manual del usuario; 30 s,
# 16:9 y 9:16, con el corte editorial del título aceptado.
HF_VALIDATED_LYRICS_TEMPLATE_IDS: frozenset[str] = frozenset({
    "lyrics-neon",
    "lyrics-amor-impredecible",
    "lyrics-caution",
    "lyrics-collage",
    "lyrics-cristal",
    "lyrics-expediente",
    "lyrics-grunge",
    "lyrics-ceniza",
    "lyrics-lluvia-gris",
    "lyrics-memoria",
    "lyrics-vacio",
    "lyrics-mixtas",
    "lyrics-impact",
    "lyrics-latido",
    "lyrics-calado",
    "lyrics-manifiesto",
    "lyrics-mirada",
    "lyrics-night-journey",
    "lyrics-resaltado",
    "lyrics-romantic",
    "lyrics-stylish-kinetic",
    "lyrics-suave",
    "lyrics-triste",
    # commercial/ con guion sincronizado (requires_lyrics): misma regla.
    "promo-kinetic",
    "promo-dynamic",
    "promo-editorial",
    "promo-sports",
    "promo-trendy",
    "promo-urban",
})

# Marca que optimize.py deja en el <script> del reloj (data-nb-hf-clock="<hash>").
_HF_CLOCK_MARKER = "data-nb-hf-clock"


def supports_niche(niche_cfg: "NicheConfig") -> bool:
    """Niches con composición portada (_COMPOSITION_BY_TEMPLATE_ID) → path optimizado.

    El path genérico (index.html de la plantilla directo) se ofrece para
    plantillas SIN letra sincronizada y para las de letras de la whitelist
    HF_VALIDATED_LYRICS_TEMPLATE_IDS: las de letras animan con su propio reloj
    (audio.currentTime / requestAnimationFrame / timers), que la captura cuadro
    a cuadro de HyperFrames no controla — probado 2026-09-25 con
    lyrics-romantic: la letra salía varios segundos atrasada. Las de la
    whitelist llevan el reloj nb-hf-clock (optimize.py) que ata todo eso al
    tiempo del cuadro, y fueron validadas una por una."""
    if _resolve_composition_dir(niche_cfg) is not None:
        return True
    if niche_cfg.template.requires_lyrics and niche_cfg.template.template_id not in HF_VALIDATED_LYRICS_TEMPLATE_IDS:
        return False
    return _resolve_template_dir(niche_cfg) is not None


def _hyperframes_bin() -> Path:
    # node_modules/.bin/hyperframes directo, nunca `npx` — mismo motivo que
    # documenta nexa-render (overhead medido ~170s en su POC con npx).
    return settings.hyperframes_project_dir / "node_modules" / ".bin" / "hyperframes"


@dataclass(frozen=True)
class _RenderPass:
    """Una pasada del CLI: un tamaño de salida, uno o más formatos que la comparten."""

    width: int  # tamaño de SALIDA (píxeles del mp4)
    height: int
    scale: int  # deviceScaleFactor: la composición mide width/scale × height/scale en CSS px
    filenames: tuple[str, ...]  # el primero se renderiza, el resto son hardlinks

    @property
    def css_width(self) -> int:
        return self.width // self.scale

    @property
    def css_height(self) -> int:
        return self.height // self.scale

    @property
    def resolution_flag(self) -> str | None:
        return _RESOLUTION_PRESETS.get((self.width, self.height)) if self.scale > 1 else None


# Presets de `hyperframes render --resolution` (supersampling con
# deviceScaleFactor entero; el CLI no acepta tamaños arbitrarios).
_RESOLUTION_PRESETS: dict[tuple[int, int], str] = {(1080, 1920): "portrait", (1920, 1080): "landscape"}


def _render_passes(niche_cfg: "NicheConfig", *, supersample: bool = True) -> list[_RenderPass]:
    """Path genérico: una pasada por tamaño de formato declarado en niches.json.

    Cada formato se renderiza a su propio tamaño (el layout de la plantilla es
    responsive: un 9:16 recortado o reusado del 16:9 corta la letra). Un 9:16
    con use_device_viewport (todos los de letras) se compone en un viewport de
    celular — la mitad del tamaño de salida en CSS px, capturado a
    deviceScaleFactor 2 —: así los detalles en px (glow, trazos, grano) guardan
    la proporción de un celular real como en la grabación Playwright, pero sin
    su reescalado: la imagen se rasteriza nativa a 1080×1920. `supersample=False`
    (render en AWS Lambda, cuyo CLI no tiene --resolution) compone a tamaño de
    salida con deviceScaleFactor 1."""
    groups: dict[tuple[int, int, int], list[str]] = {}
    for fmt in niche_cfg.video.formats:
        scale = (
            2
            if supersample
            and fmt.use_device_viewport and fmt.aspect_ratio == "9:16" and (fmt.width, fmt.height) in _RESOLUTION_PRESETS
            else 1
        )
        groups.setdefault((fmt.width, fmt.height, scale), []).append(fmt.output_filename)
    if not groups:
        groups[(1920, 1080, 1)] = ["youtube_video.mp4"]
    # 16:9 primero: es el formato obligatorio (RecordingResult.youtube_path)
    ordered = sorted(groups.items(), key=lambda kv: kv[0][0] < kv[0][1])
    return [_RenderPass(w, h, sc, tuple(names)) for (w, h, sc), names in ordered]


def _prepare_generic_html(html: str, rp: _RenderPass, duration_seconds: int, audio_filename: str) -> str:
    """index.html de la plantilla → composición HyperFrames (raíz = <body>)."""
    # HyperFrames toma tamaño/duración del elemento raíz con
    # data-composition-id + data-width/height (ver htmlBundler de
    # @hyperframes/core); sin eso renderiza en su default vertical.
    # Se usa <body> como raíz: la plantilla ocupa toda la ventana.
    # data-no-timeline: la plantilla no registra window.__timelines (anima con
    # rAF/CSS); sin la marca el engine espera 45 s por un timeline que nunca
    # llega, en cada worker, antes del primer cuadro (medido 2026-10-01).
    root_attrs = (
        f' data-composition-id="root" data-start="0" data-width="{rp.css_width}" '
        f'data-height="{rp.css_height}" data-duration="{duration_seconds}" data-fps="{_FPS}" data-no-timeline'
    )
    mix = ""
    if _HF_CLOCK_MARKER in html:
        # Plantilla optimizada: su propio <audio> queda bajo el reloj virtual
        # (nb-hf-clock le quita los data-start que inyecta el compilador, para
        # que el runtime no lo pause ni lo mezcle). La pista que HyperFrames
        # mezcla con ffmpeg es esta, estática y alineada a t=0 — el mismo
        # instante en que el reloj arranca la canción de la plantilla.
        mix = (
            f'\n<audio id="nb-hf-mix" data-nb-hf-mix src="{audio_filename}" data-start="0" '
            f'data-duration="{duration_seconds}" data-volume="1" preload="auto"></audio>'
        )
    html = re.sub(r"(<body\b[^>]*?)>", lambda m: m.group(1) + root_attrs + ">" + mix, html, count=1)
    # Ajustar src de audio (la plantilla declara song.mp3)
    return html.replace('src="song.mp3"', f'src="{audio_filename}"')


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

        bin_path = _hyperframes_bin()
        if not bin_path.exists():
            raise RecordingError(
                f"HyperframesAdapter: no se encontró el binario en {bin_path} — "
                "¿corrió `npm install` en nexa-brief-hyperframes?"
            )

        video_format = niche_cfg.get_16x9_format()
        output_filename = video_format.output_filename if video_format else "youtube_video.mp4"
        youtube_path = output_dir / output_filename

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

        config_path = output_dir / "config.json"
        bg_source = output_dir / niche_cfg.template.media_src_filename
        needs_media = niche_cfg.template.requires_image or niche_cfg.template.requires_video
        if not bg_source.exists() and (composition_dir is not None or needs_media):
            raise RecordingError(f"HyperframesAdapter: falta la imagen de fondo {bg_source}.")

        logger.info(
            "hyperframes_render_start",
            engine_target=effective_render_target,
            composition_dir=str(composition_dir),
            output=str(youtube_path),
            duration_seconds=duration_seconds,
        )

        if composition_dir is None:
            # ── Path genérico: usa el index.html de src/templates/ directo ──────
            # Funciona para TODAS las plantillas sin necesidad de portarlas a una
            # composición HyperFrames dedicada; las de letras además necesitan el
            # reloj nb-hf-clock (ver supports_niche). Una pasada por tamaño de
            # formato (ver _render_passes). El EQ en vivo de las plantillas sin
            # reloj usa WebAudio (headless = barras silenciosas); para EQ
            # precalculado hay que portar la composición.
            template_dir = _resolve_template_dir(niche_cfg)
            if template_dir is None:
                raise RecordingError(
                    f"HyperframesAdapter: no hay index.html para "
                    f"template_id={niche_cfg.template.template_id!r}."
                )
            passes = _render_passes(niche_cfg, supersample=effective_render_target != "aws")
            pass_seconds: list[float] = []
            report_step_progress(0.0)  # waiting for the render slot is not progress
            async with _get_render_semaphore():
                for i, rp in enumerate(passes):
                    site_dir = output_dir / f"_hyperframes_site_{rp.width}x{rp.height}"
                    self._stage_generic_site(
                        site_dir, template_dir, output_dir, audio_path, bg_source, rp, duration_seconds
                    )
                    t0 = time.monotonic()
                    await self._render(
                        bin_path, site_dir, output_dir / rp.filenames[0], effective_render_target,
                        output_dir.name, resolution=rp.resolution_flag, progress_span=(i, len(passes)),
                    )
                    pass_seconds.append(round(time.monotonic() - t0, 1))
                    for alias in rp.filenames[1:]:
                        alias_path = output_dir / alias
                        alias_path.unlink(missing_ok=True)
                        alias_path.hardlink_to(output_dir / rp.filenames[0])
            if not youtube_path.exists():
                # el nicho no declara 16:9: el primer formato hace de "youtube"
                youtube_path = output_dir / passes[0].filenames[0]
            stats_extra: dict = {"passes": [f"{rp.width}x{rp.height}@{rp.scale}x" for rp in passes],
                                 "pass_seconds": pass_seconds}
        else:
            # ── Path portado: composición HyperFrames dedicada ───────────────────
            # data-duration y los src de <img>/<audio> se sustituyen como texto
            # plano en el HTML estático, NO vía variables en runtime — confirmado
            # con spikes (ver docstring del módulo): el "compile" del CLI (fonts,
            # descubrimiento de assets de media) lee el HTML tal cual está en
            # disco, antes de que corra ningún script. `getVariables()` en
            # runtime sí funciona para CONTENIDO (texto/colores/arrays — no
            # requieren pre-extracción), pero no para qué archivo es cada media.
            if not config_path.exists():
                raise RecordingError(
                    f"HyperframesAdapter: falta config.json en {output_dir} "
                    "(¿corrió html_generator antes de este stage?)."
                )
            site_dir = output_dir / "_hyperframes_site"
            if site_dir.exists():
                shutil.rmtree(site_dir)
            shutil.copytree(composition_dir, site_dir)
            shutil.copy(bg_source, site_dir / bg_source.name)
            shutil.copy(audio_path, site_dir / audio_path.name)

            index_path = site_dir / "index.html"
            index_path.write_text(
                index_path.read_text(encoding="utf-8")
                .replace("{{DURATION}}", str(duration_seconds))
                .replace("{{BG_SRC}}", bg_source.name)
                .replace("{{AUDIO_SRC}}", audio_path.name),
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
            (site_dir / "_hyperframes_variables.json").write_text(json.dumps(variables), encoding="utf-8")

            report_step_progress(0.0)  # waiting for the render slot is not progress
            async with _get_render_semaphore():
                await self._render(bin_path, site_dir, youtube_path, effective_render_target, output_dir.name)
            stats_extra = {}

        logger.info("hyperframes_render_done", output=str(youtube_path))

        # Formatos que no salieron de una pasada propia (path portado: solo
        # produce 16:9) publican el mismo archivo vía hardlink — packager exige
        # un archivo físico por VideoFormat.output_filename.
        for fmt in niche_cfg.video.formats:
            fmt_path = output_dir / fmt.output_filename
            if fmt_path == youtube_path or fmt_path.exists():
                continue
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
                **stats_extra,
            },
        )

    @staticmethod
    def _stage_generic_site(
        site_dir: Path,
        template_dir: Path,
        output_dir: Path,
        audio_path: Path,
        bg_source: Path,
        rp: _RenderPass,
        duration_seconds: int,
    ) -> None:
        """Directorio efímero de una pasada: plantilla + datos del job."""
        if site_dir.exists():
            shutil.rmtree(site_dir)
        shutil.copytree(template_dir, site_dir)
        if bg_source.exists():
            shutil.copy(bg_source, site_dir / bg_source.name)
        shutil.copy(audio_path, site_dir / audio_path.name)
        # Datos del job que la plantilla pide por fetch() relativo — sin
        # lyrics.json, loadLyrics() devuelve [] y el video sale sin letra.
        for data_file in ("config.json", "lyrics.json", "manifest.json"):
            if (output_dir / data_file).exists():
                shutil.copy(output_dir / data_file, site_dir / data_file)
        index_path = site_dir / "index.html"
        index_path.write_text(
            _prepare_generic_html(index_path.read_text(encoding="utf-8"), rp, duration_seconds, audio_path.name),
            encoding="utf-8",
        )
        (site_dir / "_hyperframes_variables.json").write_text("{}", encoding="utf-8")

    async def _render(
        self,
        bin_path: Path,
        site_dir: Path,
        dest_path: Path,
        render_target: str,
        job_id: str,
        *,
        resolution: str | None = None,
        progress_span: tuple[int, int] = (0, 1),
    ) -> None:
        """Corre el CLI sobre site_dir y deja el mp4 en dest_path (borra site_dir al terminar)."""
        variables_path = site_dir / "_hyperframes_variables.json"
        output_key = None
        if render_target == "aws":
            output_key = f"renders/nexa-brief/{job_id}/{dest_path.name}"
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
                f"--execution-name={f'nexa-{job_id}-{dest_path.stem}'[:80]}",
                f"--output-key={output_key}",
                f"--variables-file={variables_path}",
                "--wait",
                "--json",
            ]
        else:
            cmd = [
                str(bin_path),
                "render",
                ".",
                f"--output={dest_path}",
                f"--workers={settings.hyperframes_workers}",
                f"--quality={settings.hyperframes_quality}",
                f"--variables-file={variables_path}",
            ]
            if resolution:
                cmd.append(f"--resolution={resolution}")

        # Con varias pasadas, el progreso del paso se reparte entre ellas.
        done, total = progress_span

        def parse_progress(line: str) -> float | None:
            fraction = parse_percent(line)
            return None if fraction is None else (done + fraction) / total

        try:
            try:
                result = await run_with_progress(
                    cmd,
                    cwd=site_dir,
                    timeout=settings.hyperframes_render_timeout_seconds,
                    parse_progress=parse_progress,
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

        if render_target == "aws":
            assert output_key is not None  # set unconditionally in the aws branch above
            await self._download_from_s3(output_key, dest_path)

        if not dest_path.exists():
            raise RecordingError(f"HyperFrames render exited 0 pero {dest_path} no fue creado")

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
