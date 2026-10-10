#!/usr/bin/env python3
"""Pide UN componente a DeepSeek con el prompt de autor y lo guarda listo para la galería.

Uso (desde nexa-brief-server/):
  .venv/bin/python src/templates/sandbox/explainer-kit/tools/deepseek_component.py rough.load "Creá rough.load: …" [--prompt prompts/component-author.md] [--tag v1]
Escribe:
  lab/deepseek/drafts/<nombre>.js      el código devuelto (lo carga showcase/stage.html?js=../lab/deepseek/drafts/<nombre>.js)
  ai-lab/<nombre>-<tag>.md             pedido, respuesta cruda, tiempos y tokens (para comparar versiones del prompt)
La clave se lee del .env de nexa-explainer (DEEPSEEK_API_KEY) y nunca se imprime.
"""
import argparse, json, pathlib, re, time, urllib.request

KIT = pathlib.Path(__file__).resolve().parents[1]
ENV = pathlib.Path("/home/university/Documentos/Proyectos/nexa-brief/nexa-explainer/nexa-explainer-server/.env")

def key():
    for line in ENV.read_text().splitlines():
        if line.startswith("DEEPSEEK_API_KEY="): return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("falta DEEPSEEK_API_KEY")

def ask(system, user, model="deepseek-flash", temperature=0.35, history=None):
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": user}] + (history or [])
    body = {"model": model, "messages": msgs,
            "temperature": temperature, "max_tokens": 8000, "thinking": {"type": "disabled"}}
    req = urllib.request.Request("https://api.deepseek.com/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Authorization": "Bearer " + key(), "Content-Type": "application/json", "User-Agent": "nexa-explainer-kit/1.0"})
    t0 = time.time()
    for attempt in range(4):                     # la API a veces deja la conexión colgada: reintentar
        try:
            with urllib.request.urlopen(req, timeout=120) as r: data = json.loads(r.read())
            return data, time.time() - t0
        except Exception as e:
            print(f"  intento {attempt + 1} falló: {type(e).__name__}; reintento…", flush=True); time.sleep(5 + attempt * 10)
    raise SystemExit("DeepSeek no respondió")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name"); ap.add_argument("task")
    ap.add_argument("--prompt", default="prompts/component-author.md"); ap.add_argument("--tag", default="v1")
    ap.add_argument("--repair", default="", help="errores/observaciones: se reenvía el código actual y se pide corregirlo")
    a = ap.parse_args()
    system = (KIT / a.prompt).read_text()
    history = None
    if a.repair:
        cur = (KIT / "lab" / "deepseek" / "drafts" / (a.name.replace(".", "-") + ".js")).read_text()
        history = [{"role": "assistant", "content": "```js\n" + cur + "\n```"},
                   {"role": "user", "content": "Lo probé en el navegador y en capturas 9:16 y 16:9. Problemas encontrados:\n" + a.repair +
                    "\n\nCorregí SOLO eso (sin romper lo que ya funciona) y devolvé el archivo COMPLETO en un único bloque ```js```."}]
    data, dt = ask(system, a.task, history=history)
    msg = data["choices"][0]["message"]["content"]
    m = re.search(r"```(?:js|javascript)?\s*\n(.*?)```", msg, re.S)
    code = (m.group(1) if m else msg).strip() + "\n"
    out = KIT / "lab" / "deepseek" / "drafts" / (a.name.replace(".", "-") + ".js"); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(f"/* generado por {data.get('model')} · prompt {a.prompt} · {a.tag} — revisar antes de usar */\n" + code)
    lab = KIT / "lab" / "deepseek"; lab.mkdir(exist_ok=True)
    u = data.get("usage", {})
    (lab / f"{a.name}-{a.tag}.md").write_text(f"# {a.name} · {a.tag}\n\nmodelo: {data.get('model')} · {dt:.1f} s · tokens in {u.get('prompt_tokens')} / out {u.get('completion_tokens')}\n\n## Pedido\n\n{a.task}\n\n## Respuesta\n\n{msg}\n")
    print(f"✓ {out.relative_to(KIT)}  ({dt:.1f}s, {u.get('completion_tokens')} tokens, modelo {data.get('model')})")

if __name__ == "__main__":
    main()
