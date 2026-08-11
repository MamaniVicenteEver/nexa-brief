#!/usr/bin/env python3
"""
06-voz-creation-cont/qwen · TEST DE CONEXIÓN con Alibaba Model Studio (DashScope)
================================================================================
Prueba pequeña para verificar que tu API key de Alibaba funciona ANTES de usar
los modelos grandes (voz, imagen, video). Llama a un modelo de texto pequeñito.

Usa el endpoint INTERNACIONAL (Singapur) — ahí es donde aplica tu CUOTA GRATIS.

Antes de correr:
  1) Copia tu token (del CSV que descargaste) al .env de la raíz del repo:
        DASHSCOPE_API_KEY=sk-xxxxxxxx...
  2) Corre desde la raíz del repo:
        uv run python html-templates/production/06-voz-creation-cont/qwen/test_conexion_dashscope.py
"""
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[3]           # qwen -> 06 -> production -> html-templates -> raíz
load_dotenv(REPO_ROOT / ".env")
KEY = os.getenv("DASHSCOPE_API_KEY", "").strip()

# Endpoint INTERNACIONAL (Singapur) — aquí se consume la cuota gratis.
BASE  = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
MODEL = "qwen-flash"        # modelo pequeño y barato, ideal para probar


def main():
    if not KEY:
        print("✖ Falta DASHSCOPE_API_KEY en el .env de la raíz.")
        print(f"  Agrega esta línea en {REPO_ROOT / '.env'} :")
        print("      DASHSCOPE_API_KEY=sk-....(tu token del CSV)")
        raise SystemExit(1)

    print(f"Probando modelo pequeño '{MODEL}' en Singapur ...\n")
    body = {
        "model": MODEL,
        "messages": [{"role": "user",
                      "content": "Responde SOLO con la palabra: FUNCIONA"}],
    }
    headers = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

    try:
        r = httpx.post(f"{BASE}/chat/completions", json=body, headers=headers, timeout=60)
    except httpx.RequestError as e:
        print("✖ Error de red:", e)
        raise SystemExit(1)

    if r.status_code != 200:
        print(f"✖ HTTP {r.status_code}: {r.text[:400]}")
        if r.status_code == 401:
            print("  → 401: la API key es inválida o quedó mal copiada.")
        elif r.status_code == 403:
            print("  → 403: falta completar la verificación de la cuenta, o es tema de cuota/región.")
        elif r.status_code == 404:
            print("  → 404: el nombre del modelo no existe en esta región; prueba 'qwen-turbo' o 'qwen-plus'.")
        raise SystemExit(1)

    j = r.json()
    msg = j["choices"][0]["message"]["content"]
    usage = j.get("usage", {})
    print("✅ ¡CONEXIÓN OK! Tu API key de Alibaba funciona.")
    print("   Respuesta del modelo:", msg.strip())
    print("   Tokens usados:", usage)
    print("\nSiguiente paso: probar Qwen3-TTS (voz) por esta misma API.")


if __name__ == "__main__":
    main()
