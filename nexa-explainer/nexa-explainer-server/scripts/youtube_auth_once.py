#!/usr/bin/env python
"""
NEXA BRIEF — Autorización única de YouTube (una sola vez para siempre)
=======================================================================
Este script hace la autorización OAuth UNA SOLA VEZ.
Después de ejecutarlo, el sistema sube videos a YouTube automáticamente
sin ninguna intervención manual adicional.

REQUISITO: client_secret.json debe ser de tipo "Desktop App" (installed),
NO de tipo "Web Application". Cámbialo en:
  https://console.cloud.google.com/apis/credentials

Uso:
    uv run youtube_auth_once.py
    uv run youtube_auth_once.py --alias canal_2   # Para el segundo canal
"""

import argparse
import json
import sys
from pathlib import Path

try:
    from google_auth_oauthlib.flow import InstalledAppFlow
except ImportError:
    print("❌ Falta google-auth-oauthlib")
    print("   Ejecuta: uv add google-auth-oauthlib")
    sys.exit(1)

# Add project root to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from src.config.settings import settings
from src.adapters.publishing.token_storage import TokenStorage

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]
SECRET_PATH = Path("client_secret.json")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--alias", default="canal_1", choices=["canal_1", "canal_2"],
                        help="Alias de la cuenta YouTube a autorizar")
    args = parser.parse_args()
    alias = args.alias

    print("=" * 60)
    print("🔑 AUTORIZACIÓN ÚNICA DE YOUTUBE — NEXA BRIEF")
    print("=" * 60)
    print(f"   Canal objetivo: {alias}")
    print()

    # ── Verificar client_secret.json ─────────────────────────────────
    if not SECRET_PATH.exists():
        print("❌ No se encontró client_secret.json")
        print("   1. Ve a: https://console.cloud.google.com/apis/credentials")
        print("   2. Crea o edita tu OAuth Client → tipo: 'App de escritorio'")
        print("   3. Descarga el JSON → renómbralo client_secret.json")
        print("   4. Colócalo en la raíz del proyecto")
        sys.exit(1)

    raw = json.loads(SECRET_PATH.read_text())
    app_type = "installed" if "installed" in raw else "web"

    if app_type == "web":
        print("❌ Tu client_secret.json es de tipo 'web' (Web Application).")
        print("   Este tipo requiere un servidor web para recibir el callback.")
        print()
        print("   SOLUCIÓN — Cambia el tipo en Google Cloud Console:")
        print("   1. https://console.cloud.google.com/apis/credentials")
        print("   2. Edita tu OAuth Client ID")
        print("   3. Cambia tipo: 'Aplicación web' → 'App de escritorio'")
        print("   4. Descarga el nuevo JSON → reemplaza client_secret.json")
        print("   5. Vuelve a ejecutar este script")
        sys.exit(1)

    print(f"✅ client_secret.json tipo: Desktop App")
    print(f"   client_id: {raw[app_type]['client_id'][:30]}...")
    print()

    # ── Verificar PUBLISHER_ENCRYPTION_KEY ───────────────────────────
    encryption_key = settings.publisher_encryption_key
    if not encryption_key:
        print("❌ Falta PUBLISHER_ENCRYPTION_KEY en el .env")
        sys.exit(1)
    print(f"✅ Clave de cifrado: OK")

    # ── OAuth Flow — abre el navegador UNA SOLA VEZ ──────────────────
    print()
    print("🌐 Abriendo navegador para autorizar...")
    print("   Selecciona tu cuenta Google y da permiso.")
    print("   Después de eso, este proceso es COMPLETAMENTE AUTOMÁTICO para siempre.")
    print()

    flow = InstalledAppFlow.from_client_secrets_file(
        str(SECRET_PATH),
        scopes=SCOPES,
    )

    # run_local_server con port=0 usa cualquier puerto libre automáticamente
    # No requiere configurar redirect_uri en Google Cloud Console para Desktop Apps
    creds = flow.run_local_server(
        port=0,
        prompt="consent",
        access_type="offline",
    )

    access_token  = creds.token
    refresh_token = creds.refresh_token
    expires_in    = 3600

    if creds.expiry:
        import datetime
        delta = creds.expiry.replace(tzinfo=None) - datetime.datetime.utcnow()
        expires_in = max(300, int(delta.total_seconds()))

    # ── Validar tokens ────────────────────────────────────────────────
    if not access_token:
        print("❌ No se obtuvo access_token. Intenta de nuevo.")
        sys.exit(1)

    if not refresh_token:
        print()
        print("⚠️  No se obtuvo refresh_token.")
        print("   Esto ocurre si ya autorizaste esta app antes sin 'offline access'.")
        print("   Solución:")
        print("   1. Ve a: https://myaccount.google.com/permissions")
        print("   2. Busca tu app 'nexa-brief' y elimínala")
        print("   3. Vuelve a ejecutar este script")
        sys.exit(1)

    # ── Guardar tokens cifrados en accounts.json ──────────────────────
    storage = TokenStorage(
        path=settings.accounts_json_path,
        encryption_key=encryption_key,
    )

    client_info = raw[app_type]

    storage.save_tokens(
        platform="youtube",
        alias=alias,
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )

    # Guardar client credentials por cuenta para el auto-refresh
    storage._data.setdefault("youtube", {}).setdefault(alias, {}).update({
        "name": alias,
        "target_id": alias,
        "client_id": client_info["client_id"],
        "client_secret": client_info["client_secret"],
    })
    storage._save()

    print()
    print("=" * 60)
    print("🎉 ¡AUTORIZACIÓN COMPLETADA!")
    print("=" * 60)
    print(f"   Canal    : youtube:{alias}")
    print(f"   Tokens   : guardados y cifrados en {settings.accounts_json_path}")
    print(f"   Expira   : en {expires_in // 3600}h (se renueva automáticamente)")
    print(f"   Refresh  : ✅ guardado — el sistema es AUTÓNOMO para siempre")
    print()
    print("📌 Próximos pasos:")
    print(f"   Agrega en .env:  ACTIVE_ACCOUNT=youtube:{alias}")
    print("   Inicia el servidor y el pipeline publica automáticamente.")
    print()
    print("✅ No necesitas volver a ejecutar este script a menos que:")
    print("   • Cambies de cuenta Google")
    print("   • Revoques el acceso manualmente en myaccount.google.com/permissions")
    print("=" * 60)


if __name__ == "__main__":
    main()
