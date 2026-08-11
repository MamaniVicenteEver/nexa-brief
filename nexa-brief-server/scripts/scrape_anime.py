#!/usr/bin/env python3
"""
Nexa-Brief: Pipeline Autónomo de Extracción de Recursos Visuales.
Optimizado para imágenes de cuerpo completo, detección inteligente de transparencia
y prevención de fallas de segmentación en rembg.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import logging
import random
import re
from dataclasses import dataclass, asdict
from io import BytesIO
from pathlib import Path
from typing import Iterable, Sequence
from urllib.parse import quote_plus

import httpx
from PIL import Image, UnidentifiedImageError
from playwright.async_api import async_playwright
from rembg import remove, new_session

# Configuración del Logger de Nexa-Brief
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [%(levelname)s] - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("nexa-brief-pipeline")

# Parámetros Estrictos de Calidad Cinematográfica
MIN_SHORT_SIDE = 1080         # Forzamos Full HD mínimo en el lado corto
MIN_AREA = 2_000_000          # Mínimo 2 Megapíxeles para permitir re-encuadres
MAX_ASPECT_RATIO = 1.8        # Evita imágenes ultra estiradas o tiras de cómic

@dataclass
class ImageRecord:
    query: str
    url: str
    filename: str
    width: int
    height: int
    bytes: int
    format: str
    aesthetic_score: float
    already_transparent: bool
    is_best: bool = False

@dataclass
class QueryResult:
    query: str
    target_count: int
    candidates_found: int
    accepted_pool_size: int
    best_candidate_filename: str | None
    raw_dir: str
    nobg_dir: str
    images: list[ImageRecord]


# ==========================================
# Núcleo de Análisis de Visión Computacional
# ==========================================

def analyze_image_properties(pil_img: Image.Image, target_ratio: float = 1.77) -> tuple[float, bool, str | None]:
    """
    Analiza la idoneidad de la imagen, detecta si ya tiene transparencia nativa
    y evalúa los riesgos de contraste para rembg.
    """
    width, height = pil_img.size
    area = width * height
    current_ratio = max(width / height, height / width)
    
    # 1. Detección Inteligente de Canal Alfa (Transparencia Nativa)
    already_transparent = False
    if pil_img.mode == "RGBA":
        alpha = pil_img.getchannel("A")
        bbox = alpha.getbbox()
        if bbox:
            already_transparent = True
            logger.info("💎 Canal Alfa activo detectado. Saltando rembg para preservar bordes perfectos.")
            return 100.0, True, None 

    # 2. Validación de Contraste para rembg (Evita Mutilaciones)
    gray = pil_img.convert("L")
    extrema = gray.getextrema()
    if not extrema or (extrema[1] - extrema[0]) < 180:
        return 0.0, False, "low_contrast_risky_for_rembg"
    
    # Análisis de Histograma para evitar fondos planos confusos
    hist = gray.histogram()
    pixels = sum(hist)
    dark_pixels = sum(hist[:30])   
    light_pixels = sum(hist[225:]) 
    
    if dark_pixels > (pixels * 0.5) or light_pixels > (pixels * 0.5):
        return 0.0, False, "high_flat_color_risk"

    # 3. Asignación de Score Estético/Técnico
    score = 0.0
    if area >= 8_000_000:    # ~4K Ultra HD
        score += 50
    elif area >= 4_000_000:  # ~2K
        score += 35
    else:                    # 1080p estándar
        score += 20

    # Puntuación de Proporción Cinematográfica
    ratio_diff = abs(current_ratio - target_ratio)
    if ratio_diff < 0.1:
        score += 50
    elif ratio_diff < 0.4:
        score += 30
    else:
        score += 10

    return score, False, None


# ==========================================
# Extracción de Infraestructura (Pinterest)
# ==========================================

def slugify(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    text = re.sub(r"[\s_-]+", "_", text)
    return text.strip("_") or "query"

def normalize_pinimg_url(url: str) -> str:
    url = url.split("?", 1)[0]
    size_re = re.compile(r"/(?:60x60|75x75|236x|474x|564x|736x)/")
    return size_re.sub("/originals/", url)

def unique_ordered(items: Iterable[str]) -> list[str]:
    seen = set()
    out = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out

async def collect_pinterest_candidates(page, query: str, max_scrolls: int = 6) -> list[str]:
    search_url = f"https://www.pinterest.com/search/pins/?q={quote_plus(query)}"
    logger.info(f"Navegando a Pinterest: {search_url}")
    
    await page.goto(search_url, wait_until="domcontentloaded", timeout=60_000)
    await asyncio.sleep(3.5)

    js_extractor = """
    () => {
      const urls = new Set();
      document.querySelectorAll("img").forEach((img) => {
        if (img.src && img.src.includes("i.pinimg.com/")) urls.add(img.src);
        if (img.currentSrc && img.currentSrc.includes("i.pinimg.com/")) urls.add(img.currentSrc);
      });
      return Array.from(urls);
    }
    """
    
    urls: list[str] = []
    for scroll in range(max_scrolls):
        raw_urls = await page.evaluate(js_extractor)
        urls = unique_ordered(urls + [normalize_pinimg_url(u) for u in raw_urls])
        await page.evaluate("window.scrollBy(0, window.innerHeight * 1.6)")
        await asyncio.sleep(1.2 + random.uniform(0.1, 0.4))
        
    return urls


# ==========================================
# Descarga, Evaluación y Guardado
# ==========================================

async def process_pool(client: httpx.AsyncClient, urls: list[str], query: str) -> list[tuple[bytes, ImageRecord]]:
    pool = []
    seen_sha = set()
    
    for idx, url in enumerate(urls[:30]): 
        try:
            resp = await client.get(url, timeout=15.0)
            if resp.status_code != 200 or not resp.content:
                continue
                
            sha = hashlib.sha256(resp.content).hexdigest()
            if sha in seen_sha:
                continue
                
            with Image.open(BytesIO(resp.content)) as img:
                img.load()
                w, h = img.size
                
                if min(w, h) < MIN_SHORT_SIDE or (max(w, h) / min(w, h)) > MAX_ASPECT_RATIO:
                    continue
                    
                score, is_transparent, reject_reason = analyze_image_properties(img)
                if score == 0.0:
                    continue
                    
                record = ImageRecord(
                    query=query,
                    url=url,
                    filename="",
                    width=w,
                    height=h,
                    bytes=len(resp.content),
                    format=img.format or "JPEG",
                    aesthetic_score=score,
                    already_transparent=is_transparent
                )
                pool.append((resp.content, record))
                seen_sha.add(sha)
                
        except Exception:
            continue
            
    pool.sort(key=lambda x: x[1].aesthetic_score, reverse=True)
    return pool


# ==========================================
# Flujo Principal
# ==========================================

async def main():
    parser = argparse.ArgumentParser(description="Nexa-Brief Asset Pipeline Pro")
    parser.add_argument("--query", action="append", required=True)
    parser.add_argument("--per-query", type=int, default=3)
    parser.add_argument("--output", default="descargas")
    args = parser.parse_args()

    base_output = Path(args.output)
    session = new_session("u2net")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        
        results = []
        
        async with httpx.AsyncClient(headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.pinterest.com/",
    "Origin": "https://www.pinterest.com",
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "cross-site"
}, follow_redirects=True) as client:
            for q in args.query:
                slug = slugify(q)
                raw_dir = base_output / slug / "raw"
                nobg_dir = base_output / slug / "nobg"
                raw_dir.mkdir(parents=True, exist_ok=True)
                nobg_dir.mkdir(parents=True, exist_ok=True)
                
                logger.info(f"🚀 Iniciando proceso inteligente para: '{q}'")
                candidates = await collect_pinterest_candidates(page, q)
                
                pool = await process_pool(client, candidates, q)
                if not pool:
                    logger.error(f"❌ Criterios mínimos no cumplidos para la búsqueda: '{q}'")
                    continue
                
                final_selection = pool[:args.per_query]
                final_selection[0][1].is_best = True
                best_filename = f"01_{slug}.png"
                
                accepted_records = []
                for idx, (content, record) in enumerate(final_selection, start=1):
                    ext = ".png" if record.format == "PNG" or record.already_transparent else ".jpg"
                    filename = f"{idx:02d}_{slug}{ext}"
                    record.filename = filename
                    
                    (raw_dir / filename).write_bytes(content)
                    
                    nobg_name = f"{idx:02d}_{slug}_nobg.png"
                    
                    if record.already_transparent:
                        (nobg_dir / nobg_name).write_bytes(content)
                        logger.info(f"✨ [Nativo OK] Asset transparente copiado directamente: {nobg_name}")
                    else:
                        try:
                            output_bytes = remove(content, session=session)
                            (nobg_dir / nobg_name).write_bytes(output_bytes)
                            logger.info(f"✂️ [rembg OK] Fondo removido con éxito: {nobg_name} (Score: {record.aesthetic_score})")
                        except Exception as e:
                            logger.error(f"Error crítico en rembg para {filename}: {e}")
                            
                    accepted_records.append(record)
                
                res = QueryResult(
                    query=q,
                    target_count=args.per_query,
                    candidates_found=len(candidates),
                    accepted_pool_size=len(accepted_records),
                    best_candidate_filename=best_filename,
                    raw_dir=str(raw_dir),
                    nobg_dir=str(nobg_dir),
                    images=accepted_records
                )
                results.append(res)
                
        await browser.close()

    manifest = {
        "system": "Nexa-Brief Asset Pipeline Pro",
        "version": "2026.2.5",
        "results": [asdict(r) for r in results]
    }
    (base_output / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info("🏁 Pipeline completado con éxito. manifest.json actualizado.")

if __name__ == "__main__":
    asyncio.run(main())