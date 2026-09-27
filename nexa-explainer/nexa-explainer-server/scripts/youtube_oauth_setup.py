#!/usr/bin/env python
"""
NEXA BRIEF — YouTube OAuth 2.0 Setup Script
============================================
Este script realiza el flujo OAuth 2.0 completo de YouTube y guarda
el access_token + refresh_token cifrados directamente en accounts.json.

CÓMO USAR:
  1. Descarga tu client_secret.json desde Google Cloud Console
  2. Colócalo en la raíz del proyecto (junto a este script)
  3. Ejecuta:  uv run youtube_oauth_setup.py
  4. Se abrirá el browser — autoriza con tu cuenta Google
  5. El script guarda los tokens en accounts.json automáticamente
  6. ¡Listo! El pipeline ya puede publicar en YouTube

ALIAS DISPONIBLES:  canal_1  |  canal_2
Para configurar el segundo canal, ejecuta de nuevo y elige 'canal_2'.
"""

import json
import sys
import webbrowser
from pathlib import Path

# Add project root to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

# ── Verificar dependencias antes de importar ────────────────────────────────
try:
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
except ImportError:
    print("❌ Falta google-auth-oauthlib. Ejecuta:  uv add google-auth-oauthlib")
    sys.exit(1)

from src.config.settings import settings
from src.adapters.publishing.token_storage import TokenStorage

# ── Scopes requeridos por el YouTube Data API v3 ────────────────────────────
SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]

# ── YouTube solo acepta redirect_uri de este tipo para apps de escritorio ───
# Para un OAuth Client de tipo "Web Application" en Google Cloud Console,
# el redirect_uri debe coincidir exactamente con lo que configuraste.
# Con google-auth-oauthlib y run_local_server, el redirect es localhost automático.


def main():
    print("=" * 65)
    print("🔑 NEXA BRIEF — CONFIGURACIÓN DE CUENTA YOUTUBE (OAuth 2.0)")
    print("=" * 65)

    # ── 1. Verificar PUBLISHER_ENCRYPTION_KEY ──────────────────────────────
    encryption_key = settings.publisher_encryption_key
    if not encryption_key:
        print("\n❌ Falta PUBLISHER_ENCRYPTION_KEY en el .env")
        print("   Genera una nueva con:")
        print('   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"')
        sys.exit(1)
    print(f"✅ Clave de cifrado detectada: {encryption_key[:10]}...{encryption_key[-4:]}")

    # ── 2. Verificar client_secret.json ────────────────────────────────────
    secret_candidates = [
        Path("client_secret.json"),
        *sorted(Path(".").glob("client_secret*.json")),
    ]
    client_secret_path = next((p for p in secret_candidates if p.exists()), None)

    if client_secret_path is None:
        print("\n❌ No se encontró client_secret.json en la raíz del proyecto.")
        print("   Pasos para obtenerlo:")
        print("   1. Ve a: https://console.cloud.google.com/apis/credentials")
        print("   2. Haz clic en tu OAuth 2.0 Client ID (nexa-brief)")
        print("   3. Botón 'DESCARGAR JSON' (o 'Download JSON')")
        print("   4. Renombra el archivo descargado a: client_secret.json")
        print("   5. Muévelo a: " + str(Path(".").absolute()))
        sys.exit(1)
    print(f"✅ client_secret.json encontrado: {client_secret_path}")

    # ── 3. Validar estructura del client_secret.json ───────────────────────
    try:
        raw = json.loads(client_secret_path.read_text())
        # Aceptar tanto "web" como "installed" (Desktop app)
        app_key = "web" if "web" in raw else "installed"
        client_info = raw.get(app_key, {})
        client_id     = client_info.get("client_id", "")
        client_secret = client_info.get("client_secret", "")
        redirect_uris = client_info.get("redirect_uris", [])
    except Exception as e:
        print(f"\n❌ Error leyendo client_secret.json: {e}")
        sys.exit(1)

    print(f"✅ App tipo: '{app_key}'")
    print(f"   client_id: {client_id[:30]}...")
    print(f"   redirect_uris: {redirect_uris}")

    # ── 4. Elegir alias de cuenta ───────────────────────────────────────────
    print("\n¿Para qué alias deseas guardar los tokens?")
    print("  [1] canal_1  (canal principal)")
    print("  [2] canal_2  (canal secundario)")
    choice = input("Elige 1 o 2 [1]: ").strip() or "1"
    account_alias = "canal_1" if choice == "1" else "canal_2"
    print(f"   Alias seleccionado: {account_alias}")

    # ── 5. OAuth Flow ───────────────────────────────────────────────────────
    print(f"\n🌐 Iniciando OAuth 2.0 flow para YouTube...")
    print("   Se abrirá el navegador. Autoriza con la cuenta Google propietaria")
    print("   del canal de YouTube que deseas vincular.\n")

    try:
        flow = InstalledAppFlow.from_client_secrets_file(
            str(client_secret_path),
            scopes=SCOPES,
        )

        # run_local_server abre el browser y escucha el callback en localhost
        # El puerto debe coincidir con uno de los redirect_uris configurados en
        # Google Cloud Console (http://localhost:PORT/ o http://localhost:PORT/callback)
        creds: Credentials = flow.run_local_server(
            port=8080,
            prompt="consent",              # Forzar pantalla de consentimiento
            access_type="offline",          # Pedir refresh_token
            open_browser=True,
        )
    except Exception as e:
        print(f"\n❌ Error durante el flujo OAuth: {e}")
        print("\n   Posibles causas:")
        print("   • El redirect_uri 'http://localhost:8080/' NO está en tu lista de")
        print("     redirect_uris en Google Cloud Console.")
        print("   Solución:")
        print("   1. Ve a https://console.cloud.google.com/apis/credentials")
        print("   2. Edita tu OAuth 2.0 Client ID")
        print("   3. En 'URIs de redireccionamiento autorizados', añade:")
        print("      http://localhost:8080/")
        print("   4. Guarda y vuelve a ejecutar este script.")
        sys.exit(1)

    # ── 6. Extraer y validar tokens ─────────────────────────────────────────
    access_token  = creds.token
    refresh_token = creds.refresh_token
    expiry        = creds.expiry

    if not access_token:
        print("❌ Error: No se obtuvo access_token del flujo OAuth.")
        sys.exit(1)
    if not refresh_token:
        print("⚠️  ADVERTENCIA: No se obtuvo refresh_token.")
        print("   Esto ocurre si la cuenta ya fue autorizada previamente sin 'access_type=offline'.")
        print("   Revoca el acceso en https://myaccount.google.com/permissions y vuelve a ejecutar.")

    print(f"\n✅ access_token  obtenido: {access_token[:20]}...")
    print(f"✅ refresh_token obtenido: {'(presente)' if refresh_token else '(ausente)'}")
    if expiry:
        print(f"   expires_at: {expiry.isoformat()}")

    # ── 7. Calcular expires_in (segundos desde ahora) ───────────────────────
    expires_in: int | None = None
    if expiry:
        import datetime
        now = datetime.datetime.utcnow()
        expires_in = max(0, int((expiry - now).total_seconds()))

    # ── 8. Guardar tokens cifrados en accounts.json ──────────────────────────
    accounts_path = settings.accounts_json_path
    print(f"\n💾 Guardando tokens cifrados en: {accounts_path}")

    storage = TokenStorage(path=accounts_path, encryption_key=encryption_key)

    # Preservar target_id si ya existía
    existing_target_id = (
        storage._data.get("youtube", {})
                      .get(account_alias, {})
                      .get("target_id", "")
    )

    storage.save_tokens(
        platform="youtube",
        alias=account_alias,
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )

    # Guardar también el client_id/secret para que el token_manager pueda refrescar
    storage._data.setdefault("youtube", {}).setdefault(account_alias, {}).update({
        "name": account_alias,
        "target_id": existing_target_id,
        "client_id": client_id,
        "client_secret": client_secret,
    })
    storage._save()

    print("\n" + "=" * 65)
    print("🎉 ¡CONFIGURACIÓN COMPLETADA CON ÉXITO!")
    print("=" * 65)
    print(f"   Plataforma : YouTube")
    print(f"   Alias      : {account_alias}")
    print(f"   Token      : cifrado en {accounts_path}")
    print(f"   Expira en  : {expires_in}s (~{expires_in // 3600}h)" if expires_in else "   Expira en  : desconocido")
    print()
    print("📝 Próximos pasos:")
    print(f"   1. Verifica tu .env:  ACTIVE_ACCOUNT=youtube:{account_alias}")
    print("      (o añádelo a la lista: tiktok:cuenta_1,youtube:canal_1,facebook:pagina_1)")
    print("   2. Ejecuta el pipeline normalmente — publicará en YouTube automáticamente.")
    print("   3. Para el segundo canal, ejecuta este script de nuevo y elige canal_2.")
    print()
    print("⚠️  IMPORTANTE — Redirect URI en Google Cloud Console:")
    print("   Si el flow OAuth no funciona en el futuro, verifica que esté configurado:")
    print("   http://localhost:8080/")
    print("   en tu lista de 'URIs de redireccionamiento autorizados'.")
    print("=" * 65)


if __name__ == "__main__":
    main()
