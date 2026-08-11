"""Diagnóstico: prueba varios modelos en Singapur para ver si ALGUNO está autorizado."""
import os
from pathlib import Path
import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[4] / ".env")   # .env en la raíz del repo
KEY = os.getenv("DASHSCOPE_API_KEY", "").strip()
print(f"key: largo={len(KEY)}  inicio={KEY[:4]}  fin={KEY[-4:]}\n")

URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"
MODELS = ["qwen-flash", "qwen-turbo", "qwen-plus", "qwen-max", "qwen3-max", "qwen3-235b-a22b-instruct-2507"]
headers = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

for m in MODELS:
    try:
        r = httpx.post(URL, json={"model": m, "messages": [{"role": "user", "content": "hola"}]},
                       headers=headers, timeout=30)
        tag = "✅ OK" if r.status_code == 200 else ""
        print(f"{m:32} -> {r.status_code} {tag}  {r.text[:110]}")
    except Exception as e:
        print(f"{m:32} -> ERROR: {e}")
