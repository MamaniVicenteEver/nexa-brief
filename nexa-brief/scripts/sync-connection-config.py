"""Export only the authenticated TikTok bridge key, never the root configuration."""
from pathlib import Path
import os
import sys
import tempfile
import httpx

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "nexa-brief-server"))
from src.config.settings import settings  # noqa: E402 - bootstrap the server package

key = settings.tiktok_service_key
if not key or "\n" in key or "\r" in key:
    raise SystemExit("Falta configurar una clave valida para el servicio TikTok.")
try:
    response = httpx.get(settings.tiktok_service_url.rstrip("/") + "/v1/accounts", headers={"X-Nexa-Tiktok-Key": key, "X-Nexa-Profile": settings.storage_profile_id}, timeout=5)
    if response.status_code != 200:
        raise SystemExit("La clave configurada no autoriza el servicio TikTok compartido.")
except httpx.HTTPError:
    raise SystemExit("No se pudo comprobar el servicio TikTok compartido.") from None
shared = settings.shared_connections_dir
if shared is None:
    raise SystemExit("Selecciona un perfil de datos antes de iniciar los servicios.")
shared.mkdir(parents=True, exist_ok=True, mode=0o700)
fd, temporary = tempfile.mkstemp(prefix=".bridge-", dir=shared)
try:
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        stream.write("TIKTOK_SERVICE_KEY=" + key + "\n")
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, shared / "tiktok-service.env")
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
