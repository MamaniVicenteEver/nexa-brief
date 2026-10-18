#!/usr/bin/env python3
"""Delegar un TEXTO a DeepSeek (guiones de narración, títulos, descripciones, ideas de escena).

Las animaciones NO se delegan: las hace quien dirige el motor. Esto es solo para texto.
Uso (desde nexa-brief-server/):
  .venv/bin/python src/templates/sandbox/nodeaction/tools/delegate_text.py PROMPT.md OUT [--json] [--model deepseek-chat]
Lee DEEPSEEK_API_KEY de nexa-brief-server/.env. Con --json exige y valida un objeto JSON.
"""
import argparse, json, pathlib, re, sys, urllib.request

SERVER = pathlib.Path(__file__).resolve().parents[5]


def key():
    for line in (SERVER / ".env").read_text().splitlines():
        if line.startswith("DEEPSEEK_API_KEY="):
            return re.sub(r"[^A-Za-z0-9_\-]", "", line.split("=", 1)[1].split("#")[0].strip().strip('"\''))
    sys.exit("falta DEEPSEEK_API_KEY en .env")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("prompt"); ap.add_argument("out")
    ap.add_argument("--json", action="store_true"); ap.add_argument("--model", default="deepseek-chat")
    a = ap.parse_args()
    body = {"model": a.model, "temperature": 0.8, "messages": [{"role": "user", "content": pathlib.Path(a.prompt).read_text()}]}
    if a.json:
        body["response_format"] = {"type": "json_object"}
    req = urllib.request.Request("https://api.deepseek.com/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {key()}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        res = json.load(r)
    text = res["choices"][0]["message"]["content"]
    if a.json:
        text = json.dumps(json.loads(text), ensure_ascii=False, indent=1)
    pathlib.Path(a.out).write_text(text)
    u = res.get("usage", {})
    print(f"✓ {a.out} · tokens: {u.get('prompt_tokens')} entrada + {u.get('completion_tokens')} salida")


if __name__ == "__main__":
    main()
