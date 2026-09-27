#!/usr/bin/env python
"""
NEXA BRIEF — TikTok OAuth 2.0 Setup Script
===========================================
Este script facilita la autorización OAuth 2.0 de TikTok y guarda
los tokens cifrados directamente en accounts.json.

CÓMO USAR:
  1. Rellena TIKTOK_CLIENT_ID, TIKTOK_CLIENT_SECRET y PUBLISHER_ENCRYPTION_KEY en tu .env
  2. Inicia tu túnel ngrok: ngrok http 8000
  3. Registra tu callback URL de ngrok en el TikTok Developer Portal (Login Kit):
     https://<TU-SUBDOMINIO>.ngrok-free.dev/api/v1/publish/auth/tiktok/callback
  4. Ejecuta este script:  uv run scripts/tiktok_setup.py
"""

import socket
import sys
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import httpx
from cryptography.fernet import Fernet

# Add project root to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from src.adapters.publishing.token_storage import TokenStorage
from src.config.settings import settings

PORT = 8000
CALLBACK_PATH = "/api/v1/publish/auth/tiktok/callback"

# Globals to share state with the server thread
captured_code = None
captured_state = None
server_should_stop = False


class TikTokCallbackHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        # Mute logging to keep CLI clean
        return

    def do_GET(self):
        global captured_code, captured_state
        parsed_url = urllib.parse.urlparse(self.path)

        if parsed_url.path == CALLBACK_PATH:
            query_params = urllib.parse.parse_qs(parsed_url.query)
            captured_code = query_params.get("code", [None])[0]
            captured_state = query_params.get("state", [None])[0]

            error = query_params.get("error", [None])[0]
            error_description = query_params.get("error_description", [None])[0]

            if error:
                self.send_response(400)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(
                    self._html_error(
                        "Autorización Denegada",
                        f"TikTok devolvió error: {error} - {error_description}",
                    ).encode("utf-8")
                )
            elif not captured_code:
                self.send_response(400)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(
                    self._html_error(
                        "Código Faltante",
                        "No se recibió código de autorización de TikTok.",
                    ).encode("utf-8")
                )
            else:
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(
                    self._html_success(
                        captured_state or "cuenta_1"
                    ).encode("utf-8")
                )
        else:
            self.send_response(404)
            self.end_headers()

    def _html_success(self, alias: str) -> str:
        return f"""<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>✅ TikTok Autorizado</title>
<style>body{{font-family:system-ui,sans-serif;background:#0d1117;color:#e6edf3;
display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}}
.box{{background:#161b22;border:1px solid #30363d;border-radius:12px;
padding:2rem 2.5rem;max-width:500px;text-align:center}}
h1{{color:#3fb950;font-size:1.8rem;margin-bottom:0.5rem}}
code{{background:#21262d;padding:0.2em 0.5em;border-radius:4px;font-size:0.9rem}}</style></head><body><div class="box">
<h1>🎉 ¡Autorización Recibida!</h1>
<p>El código de autorización para <code>tiktok:{alias}</code> ha sido capturado.</p>
<p>Puedes cerrar esta pestaña y regresar a la terminal para ver el resultado de la configuración.</p>
</div></body></html>"""

    def _html_error(self, title: str, message: str) -> str:
        return f"""<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>❌ {title}</title>
<style>body{{font-family:system-ui,sans-serif;background:#0d1117;color:#e6edf3;
display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}}
.box{{background:#161b22;border:1px solid #30363d;border-radius:12px;
padding:2rem 2.5rem;max-width:540px;text-align:center}}
h1{{color:#f85149;font-size:1.6rem}}</style></head><body><div class="box">
<h1>❌ {title}</h1><p>{message}</p>
<p>Regresa a la terminal e intenta ejecutar el script de nuevo.</p>
</div></body></html>"""


def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0


def main():
    global captured_code, captured_state

    print("=" * 65)
    print("🔑 NEXA BRIEF — CONFIGURACIÓN DE CUENTA TIKTOK (OAuth 2.0)")
    print("=" * 65)

    # ── 1. Verificar variables de entorno ───────────────────────────────────
    encryption_key = settings.publisher_encryption_key
    client_key = settings.tiktok_client_id
    client_secret = settings.tiktok_client_secret

    if not encryption_key:
        print("\n❌ Falta PUBLISHER_ENCRYPTION_KEY en el .env")
        print("   Genera una nueva con:")
        print('   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"')
        sys.exit(1)
    if not client_key or not client_secret:
        print("\n❌ Faltan TIKTOK_CLIENT_ID o TIKTOK_CLIENT_SECRET en el .env")
        sys.exit(1)

    print(f"✅ Clave de cifrado detectada.")
    print(f"✅ Client Key (Client ID): {client_key[:10]}...")
    print(f"✅ Client Secret cargado.")

    # ── 2. Elegir alias de cuenta ───────────────────────────────────────────
    print("\n¿Para qué alias deseas guardar los tokens?")
    print("  [1] cuenta_1  (cuenta principal)")
    print("  [2] cuenta_2  (cuenta secundaria)")
    choice = input("Elige 1 o 2 [1]: ").strip() or "1"
    account_alias = "cuenta_1" if choice == "1" else "cuenta_2"
    print(f"   Alias seleccionado: {account_alias}")

    # ── 3. Solicitar URL de Ngrok o Callback URL ────────────────────────────
    print("\nTikTok requiere una Redirect URI HTTPS válida (ej. ngrok).")
    print("Introduce la URL base de tu ngrok (ej: https://dispersal-sandworm-acre.ngrok-free.dev):")
    ngrok_base = input("URL de ngrok: ").strip().rstrip("/")
    if not ngrok_base.startswith("https://"):
        print("❌ La URL debe comenzar con 'https://'")
        sys.exit(1)

    redirect_uri = f"{ngrok_base}{CALLBACK_PATH}"
    print(f"\n👉 Asegúrate de que esta URL está en tu panel de TikTok Developer (Login Kit):")
    print(f"   {redirect_uri}")
    input("\nPresiona ENTER cuando hayas confirmado que la URL está configurada en TikTok...")

    # ── 4. Determinar si usar el servidor FastAPI existente o levantar uno temporal
    server = None
    fastapi_running = is_port_in_use(PORT)

    if fastapi_running:
        print("\nℹ️  Se detectó que ya hay un proceso escuchando en el puerto 8000 (FastAPI).")
        print("   Usaremos tu servidor FastAPI existente para recibir la redirección.")
    else:
        print("\n🌐 Levantando servidor local temporal en el puerto 8000...")
        try:
            server = HTTPServer(("localhost", PORT), TikTokCallbackHandler)
        except Exception as e:
            print(f"❌ No se pudo levantar el servidor en el puerto 8000: {e}")
            sys.exit(1)

    # ── 5. Construir y abrir URL de autorización ───────────────────────────
    params = {
        "client_key": client_key,
        "scope": "user.info.basic,video.upload,video.publish",
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "state": account_alias,
    }
    auth_url = f"https://www.tiktok.com/v2/auth/authorize/?{urllib.parse.urlencode(params)}"

    print(f"\n🌐 Abriendo el navegador para autorizar la aplicación...")
    print(f"   Si no se abre, haz clic en este enlace:\n   {auth_url}\n")
    webbrowser.open(auth_url)

    # ── 6. Esperar la respuesta de la redirección ───────────────────────────
    if server:
        print("⏳ Esperando respuesta de TikTok (puedes cancelar con Ctrl+C)...")
        try:
            # Escucha una única petición y detente
            server.handle_request()
        except KeyboardInterrupt:
            print("\n❌ Proceso cancelado por el usuario.")
            sys.exit(1)
        finally:
            server.server_close()
    else:
        # FastAPI está corriendo, por lo tanto el token se guardará directamente
        # a través de la ruta FastAPI que añadimos. Esperamos unos segundos.
        print("⏳ Esperando que completes la autenticación en tu navegador...")
        print("   (Presiona ENTER cuando veas la página de éxito en tu navegador)")
        input()

    # ── 7. Intercambiar código si corrimos el servidor local ────────────────
    if server:
        if not captured_code:
            print("\n❌ No se capturó ningún código de autorización.")
            sys.exit(1)

        print("\n🌐 Intercambiando código de autorización por tokens de TikTok...")
        try:
            resp = httpx.post(
                "https://open.tiktokapis.com/v2/oauth/token/",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "client_key": client_key,
                    "client_secret": client_secret,
                    "code": captured_code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                },
                timeout=30,
            )
        except Exception as e:
            print(f"❌ Error de red al contactar con TikTok: {e}")
            sys.exit(1)

        if resp.status_code != 200:
            print(f"❌ TikTok rechazó el intercambio de código (HTTP {resp.status_code}): {resp.text}")
            sys.exit(1)

        data = resp.json()
        error_code = data.get("error") or data.get("data", {}).get("error_code")
        if error_code:
            print(f"❌ TikTok devolvió un error en la respuesta: {data}")
            sys.exit(1)

        token_info = data.get("data", {})
        if not token_info:
            token_info = data

        access_token = token_info.get("access_token")
        refresh_token = token_info.get("refresh_token")
        expires_in = token_info.get("expires_in", 86400)
        refresh_expires_in = token_info.get("refresh_expires_in", 31536000)
        open_id = token_info.get("open_id")

        if not access_token:
            print(f"❌ Respuesta inválida de TikTok (falta access_token): {data}")
            sys.exit(1)

        # ── 8. Guardar tokens en accounts.json ──────────────────────────────
        accounts_path = settings.accounts_json_path
        print(f"💾 Guardando tokens cifrados en: {accounts_path}")

        storage = TokenStorage(path=accounts_path, encryption_key=encryption_key)
        storage.save_tokens(
            platform="tiktok",
            alias=account_alias,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in,
            refresh_expires_in=refresh_expires_in,
        )

        storage._data.setdefault("tiktok", {}).setdefault(account_alias, {}).update({
            "name": account_alias,
            "target_id": open_id or account_alias,
        })
        storage._save()

    print("\n" + "=" * 65)
    print("🎉 ¡TIKTOK CONFIGURADO CON ÉXITO!")
    print("=" * 65)
    print(f"   Plataforma : TikTok")
    print(f"   Alias      : {account_alias}")
    print(f"   Token      : guardado y cifrado en accounts.json")
    print()
    print("📝 Próximos pasos:")
    print(f"   1. Activa en tu .env: ACTIVE_ACCOUNT=tiktok:{account_alias}")
    print("   2. Ejecuta scripts/test_publisher_tokens.py para validar.")
    print("=" * 65)


if __name__ == "__main__":
    main()
