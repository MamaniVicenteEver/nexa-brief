"""Registra música, clips y pósteres del prototipo en la biblioteca del perfil (API en marcha)."""
import json, subprocess
API = "http://127.0.0.1:8000/api/v1/library"
cred = {c["file"]: c for c in json.load(open("media-credits.json"))}
def up(kind, path, fields):
    cmd = ["curl", "-s", "-X", "POST", f"{API}/{kind}", "-F", f"file=@{path}"]
    for k, v in fields.items():
        cmd += ["-F", f"{k}={v}"]
    d = json.loads(subprocess.run(cmd, capture_output=True, text=True).stdout)
    return d.get("asset_id"), d
ids = {}
a, d = up("music", "carefree-58s.mp3", {"template_id": "promo-mono", "track_name": "Carefree (58 s)", "artist": "Kevin MacLeod", "genre": "acoustic",
          "transcribe": "false", "description": "Kevin MacLeod (incompetech.com). CC BY 4.0, atribución obligatoria. Recorte 0-58 s con fundido.", "tags": "cc-by,instrumental,ukelele"})
ids["song"] = a
print("music", a, d.get("detail"))
for f, c in cred.items():
    n = f[:-4]
    user, page = c["user"], c["page"]
    a, d = up("videos", f"media/{f}", {"template_id": "promo-mono", "label": n, "description": f"Pixabay, autor {user}, {page} (Pixabay Content License)", "tags": "perro,adopcion,pixabay"})
    b, e = up("images", f"media/{n}-1.jpg", {"template_id": "promo-mono", "label": n + " poster", "description": f"Fotograma de {page}", "tags": "perro,adopcion,poster"})
    ids[n] = {"video": a, "poster": b}
    print(n, a, b, d.get("detail") or "", e.get("detail") or "")
json.dump(ids, open("asset-ids.json", "w"), indent=1)
