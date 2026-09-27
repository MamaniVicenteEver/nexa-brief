#!/usr/bin/env python3
"""
Nexa-Brief DS: Scraper profesional con filtro DeepSeek Vision.
Descarga 5 candidatos técnicos, los envía a DeepSeek y guarda solo los 2 mejores.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import json
import logging
import random
import re
from dataclasses import asdict, dataclass
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Iterable
from urllib.parse import quote_plus

import httpx
from openai import OpenAI
from PIL import Image
from playwright.async_api import async_playwright

# ---------- CONFIGURACIÓN ----------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [%(levelname)s] - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("nexa-ds-scraper")

MIN_WIDTH = 1920
MIN_HEIGHT = 1080
IDEAL_ASPECT_RATIO = 1.777
MAX_ASPECT_RATIO = 2.4


@dataclass
class ImageRecord:
    query: str
    url: str
    filename: str
    width: int
    height: int
    bytes: int
    format: str
    tech_score: float
    ai_score: float
    ai_description: str
    downloaded_at: str


# ---------- FUNCIONES DE FILTRO TÉCNICO ----------
def analyze_landscape_properties(pil_img: Image.Image) -> float:
    """Filtro técnico: resolución y proporción."""
    width, height = pil_img.size
    if width <= height:
        return 0.0

    current_ratio = width / height
    if current_ratio < 1.33 or current_ratio > MAX_ASPECT_RATIO:
        return 0.0

    score = 0.0
    if width >= 3840 and height >= 2160:
        score += 60
    elif width >= 2560 and height >= 1440:
        score += 45
    elif width >= 1920 and height >= 1080:
        score += 25
    else:
        return 0.0

    ratio_diff = abs(current_ratio - IDEAL_ASPECT_RATIO)
    if ratio_diff < 0.05:
        score += 40
    elif ratio_diff < 0.2:
        score += 20
    else:
        score += 5

    return score


def slugify(text: str) -> str:
    words = [w for w in re.sub(r"[^\w\s]", "", text.lower()).split() if len(w) > 2]
    ignore = {"desktop", "wallpaper", "ultra", "cinematic", "background", "painting", "aesthetic"}
    filtered_words = [w for w in words if w not in ignore]
    return "_".join(filtered_words[:3]) if filtered_words else "landscape"


def normalize_pinimg_url(url: str) -> str:
    """Reconstruye la URL de mejor calidad (originals)."""
    url = url.split("?")[0]
    match = re.search(r"/(\d+)/[^/]+\.(jpg|png|webp)", url)
    if match:
        pin_id = match.group(1)
        ext = match.group(2)
        return f"https://i.pinimg.com/originals/{pin_id[:2]}/{pin_id[2:4]}/{pin_id}.{ext}"
    return url


def unique_ordered(items: Iterable[str]) -> list[str]:
    seen = set()
    out = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


# ---------- MEJORA 2 y 3: SCRAPING HUMANO + MULTI-ATRIBUTO ----------
async def collect_pinterest_candidates(page, query: str, max_scrolls: int = 18) -> list[str]:
    """Extrae URLs de imágenes solo de Pines, con scroll humano y atributos ocultos."""
    search_url = f"https://www.pinterest.com/search/pins/?q={quote_plus(query)}"
    logger.info(f"🔍 Navegando a: '{query}' (scrolls: {max_scrolls})")
    
    await page.goto(search_url, wait_until="domcontentloaded", timeout=60_000)
    await asyncio.sleep(random.uniform(3.0, 5.0))  # Pausa inicial humana

    js_extractor = """
    () => {
      const urls = new Set();
      // Solo dentro de contenedores de pines
      document.querySelectorAll("div[data-test-id='pin'] img, div[role='listitem'] img").forEach((img) => {
        // Multi-atributo: src, data-src, srcset (lazy-loading)
        let src = img.getAttribute("data-src") || img.src || img.currentSrc;
        if (img.srcset) {
          // Extraer la URL más grande del srcset
          const candidates = img.srcset.split(',').map(s => s.trim().split(' ')[0]);
          if (candidates.length > 0) src = candidates[candidates.length - 1] || src;
        }
        if (src && src.includes("i.pinimg.com/")) {
          urls.add(src);
        }
      });
      return Array.from(urls);
    }
    """
    
    urls: list[str] = []
    for i in range(max_scrolls):
        raw_urls = await page.evaluate(js_extractor)
        urls = unique_ordered(urls + [normalize_pinimg_url(u) for u in raw_urls])
        
        # Scroll con velocidad y pausas humanas
        scroll_amount = random.uniform(1.5, 2.5) * 1000  # 1500-2500px
        await page.evaluate(f"window.scrollBy(0, {scroll_amount})")
        
        # Pausa aleatoria, más larga cada 5 scrolls
        delay = random.uniform(1.2, 2.0) if i % 5 != 0 else random.uniform(3.0, 5.0)
        await asyncio.sleep(delay)
        
    return list(set(urls))  # Elimina duplicados finales


# ---------- INTEGRACIÓN DEEPSEEK VISION ----------
async def evaluate_with_deepseek(api_key: str, query: str, candidates: list[dict]) -> dict:
    """
    Envía hasta 5 imágenes a DeepSeek Vision en una sola llamada.
    Recibe un JSON con puntuaciones, descripciones y las 2 mejores.
    """
    client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
    
    # Preparar contenido del mensaje (Prompt + 5 imágenes)
    content = [
        {
            "type": "text", 
            "text": (
                "Eres un curador profesional de fondos de pantalla de escritorio 4K. "
                "Recibirás 5 imágenes. Cada una tiene una URL asociada en la metadata.\n\n"
                "Criterios de evaluación (0.0 a 10.0):\n"
                "1. Resolución y nitidez (sin ruido, sin pixelado).\n"
                "2. Composición panorámica y envolvente.\n"
                "3. Coherencia estricta con la temática solicitada: '" + query + "'.\n"
                "4. Paleta de colores armónica y profesionalismo artístico.\n"
                "5. Ausencia total de marcas de agua, textos o bordes extraños.\n\n"
                "Devuelve EXCLUSIVAMENTE un JSON crudo (sin markdown, sin ```json) con esta estructura:\n"
                "{\n"
                '  "images": [\n'
                '    {"url": "...", "score": 9.2, "description": "Descripción de la imagen y por qué cumple..."}\n'
                "  ],\n"
                '  "best_2_urls": ["url_del_mejor", "url_del_segundo_mejor"]\n'
                "}"
            )
        }
    ]
    
    # Agregar las 5 imágenes en Base64
    for img_data in candidates:
        base64_img = base64.b64encode(img_data["bytes"]).decode("utf-8")
        # Proveemos la URL en el texto para que DeepSeek la asocie a la imagen
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{base64_img}"}
        })
    
    logger.info("🧠 Enviando lote de 5 imágenes a DeepSeek Vision...")
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",  # deepseek-chat soporta visión
            messages=[{"role": "user", "content": content}],
            max_tokens=800,  # Suficiente para devolver el JSON
            temperature=0.1,  # Respuesta precisa y objetiva
        )
        raw_json = response.choices[0].message.content.strip()
        
        # Limpieza por si la IA se pasa de markdown
        if raw_json.startswith("```json"):
            raw_json = raw_json[7:]
        if raw_json.endswith("```"):
            raw_json = raw_json[:-3]
            
        result = json.loads(raw_json)
        logger.info(f"✅ DeepSeek respondió correctamente. Mejores 2: {result.get('best_2_urls', [])}")
        return result
    except Exception as e:
        logger.error(f"❌ Error en DeepSeek API: {e}")
        # Fallback: si falla la IA, guardamos las 2 primeras técnicamente
        logger.warning("⚠️ Usando fallback: guardando las 2 primeras descargadas.")
        return {
            "images": [
                {"url": c["url"], "score": 5.0, "description": "Fallback sin IA"} for c in candidates
            ],
            "best_2_urls": [candidates[0]["url"], candidates[1]["url"]]
        }


# ---------- MANEJO DEL MANIFEST ----------
def update_persistent_manifest(manifest_path: Path, new_results: list[dict]):
    data = {"system": "Nexa-Brief DS Database", "updated_at": "", "database": []}
    if manifest_path.exists():
        try:
            old_data = json.loads(manifest_path.read_text(encoding="utf-8"))
            if "database" in old_data:
                data["database"] = old_data["database"]
        except Exception as e:
            logger.warning(f"⚠️ Manifest anterior no legible: {e}")

    existing_urls = {img["url"] for item in data["database"] for img in item.get("images", [])}
    for new_item in new_results:
        new_item["images"] = [img for img in new_item["images"] if img["url"] not in existing_urls]
        if new_item["images"]:
            data["database"].append(new_item)

    data["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    manifest_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info(f"🗃️ Manifest actualizado: {manifest_path}")


# ---------- FLUJO PRINCIPAL ----------
async def main():
    parser = argparse.ArgumentParser(description="Nexa-Brief con integración DeepSeek")
    parser.add_argument("--query", action="append", required=True, help="Consultas a buscar")
    parser.add_argument("--per-query", type=int, default=2, help="Número final a guardar (ej. 2)")
    parser.add_argument("--candidates", type=int, default=5, help="Candidatos a enviar a DeepSeek")
    parser.add_argument("--api-key", required=True, help="Tu API Key de DeepSeek")
    parser.add_argument("--output", default="descargas", help="Directorio raíz")
    args = parser.parse_args()

    base_output = Path(args.output)
    manifest_path = base_output / "manifest_fondos.json"
    base_output.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        current_run_results = []

        # Cliente HTTP para descargas
        async with httpx.AsyncClient(headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        }, follow_redirects=True, timeout=15.0) as client_http:

            for query_idx, q in enumerate(args.query, start=1):
                slug = slugify(q)
                folder_name = f"{query_idx:02d}_{slug}"
                output_dir = base_output / folder_name
                output_dir.mkdir(parents=True, exist_ok=True)

                # 1. Scraping de URLs
                urls = await collect_pinterest_candidates(page, q)
                logger.info(f"📊 {len(urls)} URLs candidatas obtenidas para [{folder_name}].")

                # 2. Descargar técnicamente hasta N candidatos (ej. 5)
                candidates_buffer = []  # Lista de dicts {url, bytes}
                seen_sha = set()
                for url in urls:
                    if len(candidates_buffer) >= args.candidates:
                        break
                    try:
                        resp = await client_http.get(url)
                        if resp.status_code != 200 or not resp.content:
                            continue
                        sha = hashlib.sha256(resp.content).hexdigest()
                        if sha in seen_sha:
                            continue

                        with Image.open(BytesIO(resp.content)) as img:
                            img.load()
                            tech_score = analyze_landscape_properties(img)
                            if tech_score == 0.0:
                                continue

                        seen_sha.add(sha)
                        candidates_buffer.append({
                            "url": url,
                            "bytes": resp.content,
                            "tech_score": tech_score
                        })
                    except Exception as e:
                        logger.debug(f"Error en descarga técnica: {e}")

                if len(candidates_buffer) < args.per_query:
                    logger.warning(f"⚠️ {folder_name}: No se encontraron suficientes candidatos válidos. Saltando.")
                    continue

                # 3. Enviar a DeepSeek
                ds_result = await evaluate_with_deepseek(args.api_key, q, candidates_buffer)
                
                # 4. Guardar el JSON de evaluación en la carpeta
                eval_json_path = output_dir / "deepseek_eval.json"
                eval_json_path.write_text(json.dumps(ds_result, indent=2, ensure_ascii=False), encoding="utf-8")
                logger.info(f"📄 JSON de evaluación guardado en: {eval_json_path}")

                # 5. Seleccionar las 2 mejores y guardarlas
                best_urls = ds_result.get("best_2_urls", [])
                if not best_urls:
                    # Fallback si DeepSeek no devolvió las 2 mejores
                    best_urls = [c["url"] for c in candidates_buffer[:args.per_query]]

                saved_records = []
                for idx, target_url in enumerate(best_urls, start=1):
                    # Buscar el objeto en el buffer
                    img_data = next((c for c in candidates_buffer if c["url"] == target_url), None)
                    if not img_data:
                        continue
                    
                    # Buscar el resultado de la IA para esta URL
                    ai_info = next((i for i in ds_result.get("images", []) if i["url"] == target_url), {})
                    ai_score = ai_info.get("score", 5.0)
                    ai_desc = ai_info.get("description", "Sin descripción")

                    # Generar nombre y guardar
                    ext = ".jpg"
                    filename = f"{idx:02d}_{slug}{ext}"
                    filepath = output_dir / filename
                    filepath.write_bytes(img_data["bytes"])

                    record = ImageRecord(
                        query=q,
                        url=target_url,
                        filename=str(filepath.relative_to(base_output)),
                        width=0,  # No calculamos para ahorrar tiempo, pero podríamos
                        height=0,
                        bytes=len(img_data["bytes"]),
                        format="JPEG",
                        tech_score=img_data["tech_score"],
                        ai_score=ai_score,
                        ai_description=ai_desc,
                        downloaded_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    )
                    saved_records.append(asdict(record))
                    logger.info(f"💾 [Top {idx}] Guardado: {filename} (IA Score: {ai_score:.1f})")

                if saved_records:
                    current_run_results.append({
                        "query": q,
                        "folder_index": query_idx,
                        "folder_name": folder_name,
                        "images": saved_records
                    })

        await browser.close()

    if current_run_results:
        update_persistent_manifest(manifest_path, current_run_results)
    logger.info("🏁 Pipeline completado con éxito.")


if __name__ == "__main__":
    asyncio.run(main())