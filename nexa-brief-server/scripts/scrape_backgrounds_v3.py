#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║        Nexa-Brief v3 — Pinterest Scraper + DeepSeek Vision Ranker           ║
║                                                                              ║
║  Flujo por query:                                                            ║
║    1. Pinterest Scraping  → DOM multi-atributo + scroll humano variable      ║
║    2. Filtro Técnico      → resolución ≥1280×720, horizontal, dedup SHA256  ║
║    3. Descarga Pool de 5  → GUARDADO EN DISCO en subcarpeta /pool/           ║
║    4. DeepSeek Vision     → evalúa las 5 con URL pública, score 0-10        ║
║    5. Top-2 promovidas    → copiadas a raíz de la carpeta con nombre final  ║
║    6. deepseek_report.json → por carpeta: evaluaciones + top_selected        ║
║    7. manifest_fondos.json → global acumulativo                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import logging
import random
import re
import shutil
from datetime import datetime
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Iterable
from urllib.parse import quote_plus

import httpx
from PIL import Image
from playwright.async_api import async_playwright

# ══════════════════════════════════════════════════════════════════════════════
# LOGGING
# ══════════════════════════════════════════════════════════════════════════════
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [%(levelname)s] - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("nexa-v3")

# ══════════════════════════════════════════════════════════════════════════════
# CONSTANTES
# ══════════════════════════════════════════════════════════════════════════════

# ── Filtro técnico (relajado para capturar más imágenes Pinterest) ────────────
# Pinterest rara vez sirve originales >1920px directamente al scraper anónimo.
# Aceptamos desde 1280×720 (HD mínimo) en adelante para llenar el pool.
TECH_MIN_WIDTH       = 1080
TECH_MIN_HEIGHT      =  620
TECH_MIN_ASPECT      = 0.8   # Un poco más permisivo que 4:3
TECH_MAX_ASPECT      = 3.5   # Ultrawide extremo

IDEAL_ASPECT_RATIO   = 1.777  # 16:9 perfecto

# Pool y selección
DEFAULT_POOL_SIZE    = 5
DEFAULT_TOP_KEEP     = 2

# Extensiones de imagen aceptadas (además de JPEG/PNG detectados por PIL)
VALID_EXTENSIONS     = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".bmp"}

# ══════════════════════════════════════════════════════════════════════════════
# PROMPTS DEEPSEEK
# ══════════════════════════════════════════════════════════════════════════════
DEEPSEEK_SYSTEM_PROMPT = """Eres un curador de arte digital y fotografía especializado
en wallpapers de escritorio de alta calidad para monitores 16:9 y ultrawide.

INSTRUCCIÓN CRÍTICA: Responde ÚNICAMENTE con un objeto JSON puro.
Sin bloques de código, sin markdown, sin texto antes o después del JSON.

Estructura EXACTA que debes devolver:
{
  "score": <float 0.0-10.0>,
  "approved": <true si score >= 6.5, false si no>,
  "subject": "<tema principal en 5-8 palabras>",
  "description": "<descripción visual objetiva: elementos, colores dominantes, atmósfera, estilo — máx 45 palabras>",
  "strengths": ["<fortaleza 1>", "<fortaleza 2>"],
  "weaknesses": ["<debilidad 1>"],
  "rejection_reason": <"razón breve" o null si approved es true>
}

CRITERIOS (suma sobre 10.0):
  2.5 pts — Calidad técnica: nitidez, sin artefactos JPEG, sin pixelado
  2.0 pts — Composición panorámica: horizontal, llena bien el espacio
  2.0 pts — Coherencia temática con el contexto del cliente
  1.5 pts — Paleta cromática: colores armoniosos y atractivos
  1.0 pts — Ausencia de texto, logos o marcas de agua invasivas
  1.0 pts — Profundidad visual: capas, perspectiva, detalles ricos

Sé riguroso pero justo. Una imagen 1080p nítida puede valer 8/10."""


def build_user_prompt(query: str, context: str, img_url: str) -> str:
    return (
        f'Contexto del cliente: "{context}"\n'
        f'Búsqueda usada en Pinterest: "{query}"\n'
        f"URL de la imagen: {img_url}\n\n"
        "Evalúa esta imagen como fondo de pantalla de escritorio. "
        "Devuelve el JSON exacto definido en el sistema."
    )


# ══════════════════════════════════════════════════════════════════════════════
# MODELOS DE DATOS
# ══════════════════════════════════════════════════════════════════════════════
@dataclass
class PoolImage:
    """Imagen descargada y guardada en la subcarpeta /pool/."""
    url:            str
    pool_filename:  str        # nombre de archivo dentro de /pool/
    pool_filepath:  Path       # ruta absoluta en /pool/
    sha256:         str
    width:          int
    height:         int
    fmt:            str        # JPEG, PNG, WEBP …
    file_size:      int        # bytes
    tech_score:     float


@dataclass
class DSEvaluation:
    """Resultado de evaluación de una imagen por DeepSeek Vision."""
    pool_image:       PoolImage
    score:            float
    approved:         bool
    subject:          str
    description:      str
    strengths:        list[str]
    weaknesses:       list[str]
    rejection_reason: str | None
    raw_response:     str
    api_error:        bool = False


# ══════════════════════════════════════════════════════════════════════════════
# UTILIDADES
# ══════════════════════════════════════════════════════════════════════════════
def slugify(text: str) -> str:
    """Slug de 3 palabras significativas para carpeta/archivo."""
    ignore = {
        "desktop", "wallpaper", "ultra", "cinematic", "background", "painting",
        "aesthetic", "digital", "sharp", "focus", "high", "quality", "best",
        "beautiful", "amazing", "stunning", "hd", "4k", "uhd", "resolution",
        "landscape", "nature", "view", "scene", "image", "photo", "art",
    }
    words = re.sub(r"[^\w\s]", "", text.lower()).split()
    words = [w for w in words if len(w) > 2 and w not in ignore]
    return "_".join(words[:3]) if words else "wallpaper"


def normalize_pinimg_url(url: str) -> str:
    """Upscale URL de miniatura Pinterest → /originals/ para máxima resolución."""
    url = url.split("?", 1)[0]
    return re.sub(r"/(?:60x60|75x75|170x|236x|474x|564x|736x)/", "/originals/", url)


def unique_ordered(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def ext_from_fmt(fmt: str) -> str:
    """Convierte formato PIL → extensión de archivo."""
    mapping = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp",
                "AVIF": ".avif", "BMP": ".bmp", "GIF": ".gif"}
    return mapping.get(fmt.upper(), ".jpg")


def analyze_tech_score(width: int, height: int) -> float:
    """
    Puntuación técnica relajada.
    Retorna 0.0 si la imagen no supera los mínimos absolutos.
    """
    if width < TECH_MIN_WIDTH or height < TECH_MIN_HEIGHT:
        return 0.0
    if width <= height:
        return 0.0   # Debe ser horizontal

    ratio = width / height
    if ratio < TECH_MIN_ASPECT or ratio > TECH_MAX_ASPECT:
        return 0.0

    # Base por resolución
    if width >= 3840:
        score = 60.0
    elif width >= 2560:
        score = 50.0
    elif width >= 1920:
        score = 35.0
    elif width >= 1280:
        score = 20.0
    else:
        return 0.0

    # Bonus por cercanía al ratio 16:9
    diff = abs(ratio - IDEAL_ASPECT_RATIO)
    if diff < 0.05:
        score += 40.0
    elif diff < 0.25:
        score += 22.0
    elif diff < 0.6:
        score += 10.0
    else:
        score += 2.0

    return round(score, 1)


# ══════════════════════════════════════════════════════════════════════════════
# SCRAPING PINTEREST
# ══════════════════════════════════════════════════════════════════════════════
async def collect_pinterest_candidates(
    page,
    query: str,
    max_scrolls: int = 18,
) -> list[str]:
    """
    Navega Pinterest con comportamiento humano y extrae URLs de imagen
    desde todos los atributos DOM disponibles (src, currentSrc, data-src, srcset).
    """
#    search_url = f"https://www.pinterest.com/search/pins/?q={quote_plus(query)}"
    search_url = f"https://es.pinterest.com/search/pins/?q={quote_plus(query)}"

    logger.info(f"🔍 Pinterest → buscando: '{query}'")

    await page.goto(search_url, wait_until="domcontentloaded", timeout=60_000)
    await asyncio.sleep(4.5 + random.uniform(0.5, 1.2))

    # Esperar a que carguen las primeras imágenes
    try:
        await page.wait_for_selector("img[src*='pinimg.com']", timeout=10_000)
    except Exception:
        logger.debug("   Timeout esperando img[src*=pinimg] — continuando igual")

    js_extractor = r"""
    () => {
      const urls = new Set();
      document.querySelectorAll("img").forEach((img) => {
        // Atributos directos
        [img.src, img.currentSrc, img.dataset.src, img.dataset.lazySrc,
         img.getAttribute("data-original"), img.getAttribute("data-pin-media")
        ].forEach(u => {
          if (u && u.includes("i.pinimg.com")) urls.add(u);
        });
        // srcset: "url 1x, url 2x" → todas las entradas
        if (img.srcset) {
          img.srcset.split(",").forEach(entry => {
            const u = entry.trim().split(" ")[0];
            if (u && u.includes("i.pinimg.com")) urls.add(u);
          });
        }
      });
      // También buscamos en atributos de contenedores Pinterest
      document.querySelectorAll("[data-test-id='pin-visual-wrapper'] [style*='pinimg']").forEach(el => {
        const style = el.getAttribute("style") || "";
        const match = style.match(/url\("?(https:\/\/i\.pinimg\.com[^")\s]+)"?\)/);
        if (match) urls.add(match[1]);
      });
      return Array.from(urls);
    }
    """

    all_urls: list[str] = []

    for scroll_i in range(1, max_scrolls + 1):
        raw = await page.evaluate(js_extractor)
        normalized = [normalize_pinimg_url(u) for u in raw]
        all_urls = unique_ordered(all_urls + normalized)

        # Scroll variable para imitar comportamiento humano
        scroll_factor = random.uniform(1.3, 2.8)
        await page.evaluate(f"window.scrollBy(0, window.innerHeight * {scroll_factor})")

        if scroll_i % 5 == 0:
            wait = 2.5 + random.uniform(0.5, 1.5)
            logger.debug(f"   ⏸  Pausa larga scroll {scroll_i} ({wait:.1f}s) — {len(all_urls)} URLs")
        else:
            wait = 1.0 + random.uniform(0.2, 0.6)

        await asyncio.sleep(wait)

    # Filtramos URLs que claramente son miniaturas pequeñas sin camino a /originals/
    filtered = [u for u in all_urls if "/originals/" in u or "pinimg.com" in u]
    logger.info(f"📋 {len(filtered)} URLs únicas recolectadas ({len(all_urls)} totales)")
    return filtered if filtered else all_urls


# ══════════════════════════════════════════════════════════════════════════════
# DESCARGA Y FILTRO TÉCNICO → guarda en /pool/
# ══════════════════════════════════════════════════════════════════════════════
async def build_and_save_pool(
    client: httpx.AsyncClient,
    urls: list[str],
    pool_dir: Path,
    slug: str,
    pool_size: int,
) -> list[PoolImage]:
    """
    Descarga imágenes hasta llenar el pool.
    TODAS las imágenes válidas se guardan en pool_dir ANTES de enviarlas a DeepSeek.
    """
    pool: list[PoolImage] = []
    seen_sha: set[str] = set()
    stats = {"rejected_http": 0, "rejected_tech": 0, "rejected_dup": 0, "tried": 0}

    pool_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"📥 Descargando pool de {pool_size} imágenes → {pool_dir}")

    for url in urls:
        if len(pool) >= pool_size:
            break

        stats["tried"] += 1
        try:
            resp = await client.get(url, timeout=18.0)

            if resp.status_code == 403:
                # Pinterest a veces bloquea; intentamos con referer alternativo
                logger.debug(f"   403 en {url} — reintentando sin Referer")
                resp = await client.get(
                    url, timeout=18.0,
                    headers={"Referer": "https://www.google.com/"}
                )

            if resp.status_code != 200 or len(resp.content) < 5_000:
                stats["rejected_http"] += 1
                logger.debug(f"   ✗  HTTP {resp.status_code} | {url}")
                continue

            sha = hashlib.sha256(resp.content).hexdigest()
            if sha in seen_sha:
                stats["rejected_dup"] += 1
                continue

            # Verificar que PIL puede abrir la imagen
            try:
                with Image.open(BytesIO(resp.content)) as img:
                    img.load()
                    w, h = img.size
                    fmt = img.format or "JPEG"
            except Exception as exc:
                logger.debug(f"   ✗  PIL no puede abrir: {exc} | {url}")
                stats["rejected_tech"] += 1
                continue

            tech_score = analyze_tech_score(w, h)
            if tech_score == 0.0:
                stats["rejected_tech"] += 1
                logger.debug(f"   ✗  Técnico [{w}×{h}, ratio={w/h:.2f}] {url}")
                continue

            seen_sha.add(sha)
            pool_idx = len(pool) + 1
            ext = ext_from_fmt(fmt)
            pool_filename = f"pool_{pool_idx:02d}_{slug}{ext}"
            pool_filepath = pool_dir / pool_filename

            pool_filepath.write_bytes(resp.content)

            img_record = PoolImage(
                url=url,
                pool_filename=pool_filename,
                pool_filepath=pool_filepath,
                sha256=sha,
                width=w,
                height=h,
                fmt=fmt,
                file_size=len(resp.content),
                tech_score=tech_score,
            )
            pool.append(img_record)

            logger.info(
                f"   ✓  [{pool_idx}/{pool_size}] Descargada → {pool_filename} "
                f"[{w}×{h}, ratio={w/h:.2f}, tech={tech_score:.0f}, "
                f"{len(resp.content)//1024}KB]"
            )

        except Exception as exc:
            logger.debug(f"   ⚠  Error descargando {url}: {exc}")
            continue

    logger.info(
        f"📊 Pool completado: {len(pool)}/{pool_size} imágenes | "
        f"HTTP-errores={stats['rejected_http']} | "
        f"Técnico-rechazados={stats['rejected_tech']} | "
        f"Duplicados={stats['rejected_dup']} | "
        f"URLs probadas={stats['tried']}"
    )
    return pool


# ══════════════════════════════════════════════════════════════════════════════
# DEEPSEEK VISION — evalúa cada imagen del pool via URL pública
# ══════════════════════════════════════════════════════════════════════════════
async def evaluate_with_deepseek(
    http_client: httpx.AsyncClient,
    img: PoolImage,
    query: str,
    context: str,
    api_key: str,
    api_base: str,
    min_score: float,
) -> DSEvaluation:
    """
    Envía la URL pública de Pinterest a DeepSeek Vision (deepseek-chat con vision).
    DeepSeek descarga la imagen directamente desde la URL — no enviamos base64.

    Nota: deepseek-chat no soporta base64 en image_url.
    Usamos la URL original de Pinterest que sigue siendo accesible públicamente.
    """
    payload = {
        "model": "deepseek-vl",
        "max_tokens": 500,
        "temperature": 0.05,   # Muy determinista para JSON consistente
        "messages": [
            {
                "role": "system",
                "content": DEEPSEEK_SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": img.url,   # URL pública de Pinterest
                        },
                    },
                    {
                        "type": "text",
                        "text": build_user_prompt(query, context, img.url),
                    },
                ],
            },
        ],
    }

    raw_text = ""
    try:
        resp = await http_client.post(
            f"{api_base}/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=60.0,
        )

        if resp.status_code != 200:
            body = resp.text[:400]
            raise RuntimeError(f"HTTP {resp.status_code}: {body}")

        data = resp.json()
        raw_text = data["choices"][0]["message"]["content"].strip()

        # Limpieza robusta de markdown
        clean = re.sub(r"```(?:json)?", "", raw_text, flags=re.IGNORECASE)
        clean = clean.replace("```", "").strip()

        # Buscar el bloque JSON (a veces hay texto antes)
        json_match = re.search(r"\{.*\}", clean, flags=re.DOTALL)
        if not json_match:
            raise ValueError(f"No se encontró JSON en la respuesta: {clean[:200]}")

        parsed = json.loads(json_match.group())

        score = float(parsed.get("score", 0.0))
        return DSEvaluation(
            pool_image=img,
            score=score,
            approved=bool(parsed.get("approved", score >= min_score)),
            subject=str(parsed.get("subject", "Sin descripción")),
            description=str(parsed.get("description", "")),
            strengths=list(parsed.get("strengths", [])),
            weaknesses=list(parsed.get("weaknesses", [])),
            rejection_reason=parsed.get("rejection_reason"),
            raw_response=raw_text,
            api_error=False,
        )

    except Exception as exc:
        logger.warning(f"   ⚠  DeepSeek error [{img.pool_filename}]: {exc}")
        return DSEvaluation(
            pool_image=img,
            score=0.0,
            approved=False,
            subject="Error de evaluación DeepSeek",
            description=f"La API falló: {exc}",
            strengths=[],
            weaknesses=["Error de API DeepSeek"],
            rejection_reason=str(exc),
            raw_response=raw_text or "Sin respuesta",
            api_error=True,
        )


async def evaluate_pool(
    http_client: httpx.AsyncClient,
    pool: list[PoolImage],
    query: str,
    context: str,
    api_key: str,
    api_base: str,
    min_score: float,
) -> list[DSEvaluation]:
    """
    Evalúa todas las imágenes del pool de forma secuencial.
    Retorna la lista de evaluaciones ordenada por score DESC.
    """
    evaluations: list[DSEvaluation] = []
    logger.info(f"🤖 DeepSeek Vision → evaluando {len(pool)} imágenes del pool…")

    for i, img in enumerate(pool, start=1):
        logger.info(
            f"   🔬 [{i}/{len(pool)}] {img.pool_filename} "
            f"[{img.width}×{img.height}] → enviando a DeepSeek…"
        )

        ev = await evaluate_with_deepseek(
            http_client, img, query, context, api_key, api_base, min_score
        )
        evaluations.append(ev)

        if ev.api_error:
            logger.warning(f"   ⚡ API error — imagen será ignorada en ranking")
        else:
            status = "✅ APROBADA" if ev.approved else "❌ RECHAZADA"
            logger.info(
                f"   {status} score={ev.score:.1f}/10 | {ev.subject}"
            )
            if ev.weaknesses:
                logger.debug(f"      Debilidades: {', '.join(ev.weaknesses)}")

        # Pequeña pausa entre llamadas a la API
        if i < len(pool):
            await asyncio.sleep(0.8 + random.uniform(0.1, 0.4))

    # Ordenar por score descendente
    evaluations.sort(key=lambda e: e.score, reverse=True)
    return evaluations


# ══════════════════════════════════════════════════════════════════════════════
# GUARDADO FINAL Y REPORTE
# ══════════════════════════════════════════════════════════════════════════════
def promote_top_images(
    output_dir: Path,
    folder_name: str,
    slug: str,
    evaluations: list[DSEvaluation],
    top_keep: int,
) -> list[dict]:
    """
    Copia las top_keep mejores imágenes desde /pool/ a la raíz de output_dir
    con nombre final numerado. Retorna lista de records guardados.
    """
    top = evaluations[:top_keep]
    saved: list[dict] = []

    logger.info(f"🏆 Promoviendo top-{top_keep} imágenes a {folder_name}/")

    for rank_i, ev in enumerate(top, start=1):
        src = ev.pool_image.pool_filepath
        ext = ext_from_fmt(ev.pool_image.fmt)
        dest_filename = f"{rank_i:02d}_{slug}{ext}"
        dest_path = output_dir / dest_filename

        shutil.copy2(src, dest_path)

        logger.info(
            f"   💾 [Top {rank_i}/{top_keep}] {dest_filename} "
            f"(DeepSeek score: {ev.score:.1f}/10 — {ev.subject})"
        )

        saved.append({
            "rank":             rank_i,
            "url":              ev.pool_image.url,
            "pool_filename":    ev.pool_image.pool_filename,
            "final_filename":   f"{folder_name}/{dest_filename}",
            "width":            ev.pool_image.width,
            "height":           ev.pool_image.height,
            "file_size_kb":     round(ev.pool_image.file_size / 1024, 1),
            "tech_score":       ev.pool_image.tech_score,
            "deepseek_score":   ev.score,
            "subject":          ev.subject,
            "description":      ev.description,
            "downloaded_at":    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        })

    return saved


def write_deepseek_report(
    output_dir: Path,
    folder_name: str,
    slug: str,
    query: str,
    context: str,
    pool: list[PoolImage],
    evaluations: list[DSEvaluation],
    top_keep: int,
    saved_records: list[dict],
) -> None:
    """
    Escribe deepseek_report.json en la carpeta de la query.

    Estructura:
      _meta              → metadatos del run
      deepseek_evaluations → las N imágenes del pool evaluadas (orden por score)
      top_selected       → las mejores seleccionadas con URL y filename final
    """
    # Todas las evaluadas, ordenadas por score
    all_evals_entry = []
    for rank_pos, ev in enumerate(evaluations, start=1):
        all_evals_entry.append({
            "rank":              rank_pos,
            "pool_file":         ev.pool_image.pool_filename,
            "url":               ev.pool_image.url,
            "dimensions":        f"{ev.pool_image.width}×{ev.pool_image.height}",
            "file_size_kb":      round(ev.pool_image.file_size / 1024, 1),
            "tech_score":        ev.pool_image.tech_score,
            "deepseek_score":    ev.score,
            "approved":          ev.approved,
            "subject":           ev.subject,
            "description":       ev.description,
            "strengths":         ev.strengths,
            "weaknesses":        ev.weaknesses,
            "rejection_reason":  ev.rejection_reason,
            "api_error":         ev.api_error,
        })

    # Solo los top seleccionados
    top_entry = []
    for rec in saved_records:
        top_entry.append({
            "rank":           rec["rank"],
            "url":            rec["url"],
            "final_filename": rec["final_filename"],
            "pool_file":      rec["pool_filename"],
            "score":          rec["deepseek_score"],
            "subject":        rec["subject"],
        })

    report = {
        "_meta": {
            "system":       "Nexa-Brief v3 — DeepSeek Vision Report",
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "folder":       folder_name,
            "query":        query,
            "context":      context,
            "pool_size":    len(pool),
            "top_keep":     top_keep,
            "pool_folder":  f"{folder_name}/pool/",
        },
        "deepseek_evaluations": all_evals_entry,
        "top_selected": top_entry,
    }

    report_path = output_dir / "deepseek_report.json"
    report_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    logger.info(f"   📄 Reporte guardado → {report_path}")


# ══════════════════════════════════════════════════════════════════════════════
# MANIFEST GLOBAL
# ══════════════════════════════════════════════════════════════════════════════
def update_manifest(manifest_path: Path, new_batch: list[dict]) -> None:
    """Actualiza manifest_fondos.json sin duplicar URLs ya registradas."""
    data: dict = {
        "system":     "Nexa-Brief v3 — Background Pipeline DB",
        "updated_at": "",
        "total_images": 0,
        "database":   [],
    }

    if manifest_path.exists():
        try:
            old = json.loads(manifest_path.read_text(encoding="utf-8"))
            if "database" in old:
                data["database"] = old["database"]
        except Exception as e:
            logger.warning(f"⚠  Manifest anterior no legible: {e}")

    existing_urls = {
        img["url"]
        for item in data["database"]
        for img in item.get("images", [])
    }

    added = 0
    for item in new_batch:
        new_imgs = [i for i in item["images"] if i["url"] not in existing_urls]
        if new_imgs:
            item = {**item, "images": new_imgs}
            data["database"].append(item)
            added += len(new_imgs)

    data["total_images"] = sum(len(i.get("images", [])) for i in data["database"])
    data["updated_at"]   = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    manifest_path.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    logger.info(
        f"🗃  Manifest actualizado → {manifest_path} "
        f"(+{added} nuevas, total={data['total_images']})"
    )


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Nexa-Brief v3 — Pinterest Scraper + DeepSeek Vision Ranker",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
EJEMPLOS:
  # Básico con 1 query:
  uv run python scrape_backgrounds_v3.py \\
    --query "shan shui pagoda mist sakura landscape" \\
    --context "Arte chino tradicional para monitor ultrawide minimalista" \\
    --deepseek-key sk-xxxxxx \\
    --output descargas

  # Multi-query, pool 8, guardar top 3:
  uv run python scrape_backgrounds_v3.py \\
    --query "japan kyoto temple night cherry blossom lofi" \\
    --query "iceland northern lights aurora photography landscape" \\
    --query "cosmic nebula deep space interstellar painting" \\
    --context "Wallpapers cinematográficos para gaming setup ultrawide" \\
    --deepseek-key sk-xxxxxx \\
    --pool-size 8 --top-keep 3 --min-score 7.0 \\
    --output descargas

  # Solo scraping, sin IA (debug):
  uv run python scrape_backgrounds_v3.py \\
    --query "mountain fog forest mist" \\
    --context "prueba" \\
    --no-ai --pool-size 5 --top-keep 5 \\
    --output test_output
        """,
    )

    parser.add_argument(
        "--query", action="append", required=True, metavar="QUERY",
        help="Búsqueda Pinterest (repetir para múltiples temas)",
    )
    parser.add_argument(
        "--context", required=True, metavar="TEXTO",
        help="Contexto para DeepSeek: qué estilo buscas y para qué",
    )
    parser.add_argument(
        "--deepseek-key", default="", metavar="API_KEY",
        help="API Key de DeepSeek (requerida sin --no-ai)",
    )
    parser.add_argument(
        "--deepseek-base", default="https://api.deepseek.com", metavar="URL",
        help="Base URL de la API DeepSeek (default: https://api.deepseek.com)",
    )
    parser.add_argument(
        "--pool-size", type=int, default=DEFAULT_POOL_SIZE, metavar="N",
        help=f"Imágenes a descargar/evaluar por query (default: {DEFAULT_POOL_SIZE})",
    )
    parser.add_argument(
        "--top-keep", type=int, default=DEFAULT_TOP_KEEP, metavar="N",
        help=f"Top imágenes a promover como resultado final (default: {DEFAULT_TOP_KEEP})",
    )
    parser.add_argument(
        "--min-score", type=float, default=6.5, metavar="FLOAT",
        help="Score mínimo DeepSeek para 'approved' (default: 6.5 sobre 10.0)",
    )
    parser.add_argument(
        "--scrolls", type=int, default=18, metavar="N",
        help="Scrolls en Pinterest por query (default: 18)",
    )
    parser.add_argument(
        "--output", default="descargas", metavar="DIR",
        help="Carpeta raíz de salida (default: descargas)",
    )
    parser.add_argument(
        "--no-ai", action="store_true",
        help="Desactiva DeepSeek; guarda todas las imágenes del pool sin evaluar",
    )
    parser.add_argument(
        "--debug", action="store_true",
        help="Activa logging DEBUG",
    )

    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    if not args.no_ai and not args.deepseek_key:
        parser.error("--deepseek-key es obligatorio (o usa --no-ai para deshabilitar IA)")

    if args.top_keep > args.pool_size:
        parser.error(
            f"--top-keep ({args.top_keep}) no puede ser mayor que --pool-size ({args.pool_size})"
        )

    base_output   = Path(args.output)
    manifest_path = base_output / "manifest_fondos.json"
    base_output.mkdir(parents=True, exist_ok=True)

    logger.info("=" * 70)
    logger.info("  Nexa-Brief v3 — Pipeline iniciado")
    logger.info(f"  Queries      : {len(args.query)}")
    logger.info(f"  Pool size    : {args.pool_size} imágenes por query (guardadas en /pool/)")
    logger.info(f"  Top keep     : {args.top_keep} promovidas como resultado final")
    logger.info(f"  Score mínimo : {args.min_score}/10.0")
    logger.info(f"  Modo IA      : {'DeepSeek Vision' if not args.no_ai else 'DESACTIVADO (--no-ai)'}")
    logger.info(f"  Salida       : {base_output.resolve()}")
    logger.info("=" * 70)

    # Headers para descargar imágenes de Pinterest
    img_headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
        "Accept":           "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language":  "en-US,en;q=0.9",
        "Referer":          "https://www.pinterest.com/",
        "sec-ch-ua":        '"Chromium";v="125", "Google Chrome";v="125"',
        "sec-ch-ua-mobile": "?0",
        "sec-fetch-dest":   "image",
        "sec-fetch-mode":   "no-cors",
        "sec-fetch-site":   "cross-site",
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            locale="en-US",
        )
        page = await ctx.new_page()

        run_results: list[dict] = []

        async with httpx.AsyncClient(
            headers=img_headers,
            follow_redirects=True,
            timeout=20.0,
        ) as http_client:

            for query_idx, q in enumerate(args.query, start=1):
                slug        = slugify(q)
                folder_name = f"{query_idx:02d}_{slug}"
                output_dir  = base_output / folder_name
                pool_dir    = output_dir / "pool"
                output_dir.mkdir(parents=True, exist_ok=True)

                logger.info("")
                logger.info("─" * 70)
                logger.info(f"  QUERY {query_idx}/{len(args.query)} → [{folder_name}]")
                logger.info(f"  Búsqueda: {q}")
                logger.info("─" * 70)

                # ── Etapa 1: Scraping ──────────────────────────────────────
                candidates = await collect_pinterest_candidates(
                    page, q, max_scrolls=args.scrolls
                )

                if not candidates:
                    logger.warning(f"⚠  Sin URLs para '{q}' — saltando")
                    continue

                # ── Etapa 2: Descarga + filtro técnico → /pool/ ────────────
                pool = await build_and_save_pool(
                    http_client, candidates, pool_dir, slug, args.pool_size
                )

                if not pool:
                    logger.warning(
                        f"⚠  Pool vacío para '{q}' — "
                        "intenta con --scrolls 25 o revisa la query"
                    )
                    continue

                logger.info(
                    f"📁 Pool guardado en: {pool_dir} "
                    f"({len(pool)} imágenes listas para DeepSeek)"
                )

                # ── Etapa 3: Evaluación DeepSeek ───────────────────────────
                if args.no_ai:
                    logger.info(f"⏭  --no-ai activo → promoviendo top-{args.top_keep} por tech_score")
                    top_by_tech = sorted(pool, key=lambda c: c.tech_score, reverse=True)
                    saved_records: list[dict] = []
                    for rank_i, img in enumerate(top_by_tech[:args.top_keep], start=1):
                        ext  = ext_from_fmt(img.fmt)
                        dest = output_dir / f"{rank_i:02d}_{slug}{ext}"
                        shutil.copy2(img.pool_filepath, dest)
                        saved_records.append({
                            "rank":           rank_i,
                            "url":            img.url,
                            "pool_filename":  img.pool_filename,
                            "final_filename": f"{folder_name}/{dest.name}",
                            "width":          img.width,
                            "height":         img.height,
                            "file_size_kb":   round(img.file_size / 1024, 1),
                            "tech_score":     img.tech_score,
                            "deepseek_score": None,
                            "subject":        "IA desactivada",
                            "description":    "",
                            "downloaded_at":  datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        })
                        logger.info(f"   💾 Guardado: {dest.name} (tech_score={img.tech_score})")

                else:
                    # ── Etapa 4: DeepSeek Vision ───────────────────────────
                    evaluations = await evaluate_pool(
                        http_client, pool, q, args.context,
                        args.deepseek_key, args.deepseek_base, args.min_score,
                    )

                    # ── Etapa 5: Promover top-N a raíz de carpeta ──────────
                    saved_records = promote_top_images(
                        output_dir, folder_name, slug, evaluations, args.top_keep
                    )

                    # ── Etapa 6: deepseek_report.json ─────────────────────
                    write_deepseek_report(
                        output_dir, folder_name, slug, q, args.context,
                        pool, evaluations, args.top_keep, saved_records,
                    )

                # Acumular para manifest global
                if saved_records:
                    run_results.append({
                        "query":        q,
                        "context":      args.context,
                        "folder_index": query_idx,
                        "folder_name":  folder_name,
                        "images":       saved_records,
                    })

                logger.info(
                    f"\n  ✅ [{folder_name}] → "
                    f"{len(pool)} en /pool/, "
                    f"{len(saved_records)} promovidas como resultado final\n"
                )

        await browser.close()

    # ── Etapa 7: Manifest global ───────────────────────────────────────────
    if run_results:
        update_manifest(manifest_path, run_results)

    logger.info("")
    logger.info("=" * 70)
    logger.info("  🏁  Nexa-Brief v3 — Pipeline completado")
    logger.info(f"  Resultado en: {base_output.resolve()}")
    logger.info("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())