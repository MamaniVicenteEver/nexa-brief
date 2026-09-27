#!/usr/bin/env python
"""
NEXA BRIEF — Facebook Page Token Setup Script
==============================================
Este script intercambia un token de usuario temporal de Facebook por un
Page Access Token de larga duración (que nunca expira) y lo guarda
cifrado en accounts.json.

CÓMO OBTENER EL TOKEN TEMPORAL DE USUARIO:
  1. Ve a: https://developers.facebook.com/tools/explorer/
  2. Selecciona tu App en "Meta App".
  3. En "User or Page" selecciona "User Token".
  4. En "Permissions", agrega:
       - pages_manage_posts
       - pages_read_engagement
       - pages_show_list
  5. Clic en "Generate Access Token", autoriza la ventana emergente.
  6. Copia el token (comienza con EAA...) y pégalo cuando el script te lo pida.
"""

import sys
from pathlib import Path
import httpx

# Add project root to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from src.config.settings import settings
from src.adapters.publishing.token_storage import TokenStorage

_GRAPH_BASE = "https://graph.facebook.com/v21.0"

# OAuth URL de referencia:
# https://www.facebook.com/v25.0/dialog/oauth?client_id=899773295738132&redirect_uri=https://nexa-brief.vercel.app/&response_type=token&scope=pages_manage_posts,pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging
def main():
    print("=" * 65)
    print("🔑 NEXA BRIEF — CONFIGURACIÓN DE CUENTA FACEBOOK")
    print("=" * 65)

    # ── 1. Verificar variables de entorno ───────────────────────────────────
    encryption_key = settings.publisher_encryption_key
    app_id = settings.facebook_client_id  # client_id en settings mapea a FACEBOOK_CLIENT_ID
    
    # Intentar obtener secret directamente si no está en settings o cargarlo del .env
    app_secret = getattr(settings, "facebook_client_secret", None)
    if not app_secret:
        # Buscar en el .env si no fue expuesto por settings
        for line in Path(".env").read_text().splitlines():
            if line.startswith("FACEBOOK_CLIENT_SECRET="):
                app_secret = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

    if not encryption_key:
        print("❌ Falta PUBLISHER_ENCRYPTION_KEY en el .env")
        sys.exit(1)
    if not app_id:
        print("❌ Falta FACEBOOK_CLIENT_ID en el .env")
        sys.exit(1)
    if not app_secret:
        print("❌ Falta FACEBOOK_CLIENT_SECRET en el .env")
        print("   Por favor agrégalo en tu archivo .env e intenta de nuevo.")
        sys.exit(1)

    print(f"✅ Clave de cifrado detectada.")
    print(f"✅ App ID: {app_id}")
    print(f"✅ App Secret cargada.")

    # ── 2. Solicitar inputs al usuario ──────────────────────────────────────
    print("\n[Paso 1] Introduce el User Access Token temporal de Graph Explorer:")
    user_token = input("Token (EAA...): ").strip()
    if not user_token.startswith("EAA"):
        print("❌ El token introducido no parece ser un token válido de Facebook (debe iniciar con 'EAA').")
        sys.exit(1)

    # ── 3. Intercambiar por un Long-Lived User Token (60 días) ──────────────
    print("\n🌐 Intercambiando por Long-Lived User Token...")
    try:
        url = f"{_GRAPH_BASE}/oauth/access_token"
        params = {
            "grant_type": "fb_exchange_token",
            "client_id": app_id,
            "client_secret": app_secret,
            "fb_exchange_token": user_token
        }
        resp = httpx.get(url, params=params)
        if resp.status_code != 200:
            print(f"❌ Error al obtener Long-Lived User Token (HTTP {resp.status_code}): {resp.text}")
            sys.exit(1)
        
        long_lived_user_token = resp.json().get("access_token")
        print("✅ Long-Lived User Token obtenido con éxito.")
    except Exception as e:
        print(f"❌ Error de red: {e}")
        sys.exit(1)

    # ── 4. Obtener las páginas administradas por este usuario ───────────────
    print("\n🌐 Obteniendo lista de páginas de Facebook vinculadas...")
    try:
        url = f"{_GRAPH_BASE}/me/accounts"
        params = {
            "access_token": long_lived_user_token
        }
        resp = httpx.get(url, params=params)
        if resp.status_code != 200:
            print(f"❌ Error al obtener páginas (HTTP {resp.status_code}): {resp.text}")
            sys.exit(1)
        
        pages = resp.json().get("data", [])
        if not pages:
            print("❌ No se encontraron páginas de Facebook asociadas a esta cuenta.")
            print("   Asegúrate de que el token tiene los permisos 'pages_show_list' y 'pages_read_engagement'.")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Error de red: {e}")
        sys.exit(1)

    print("\nPáginas disponibles:")
    for idx, page in enumerate(pages, 1):
        print(f"  [{idx}] {page.get('name')} (ID: {page.get('id')})")
    
    choice = input(f"Elige una página (1-{len(pages)}) [1]: ").strip() or "1"
    try:
        selected_page = pages[int(choice) - 1]
    except (ValueError, IndexError):
        print("❌ Selección inválida.")
        sys.exit(1)
        
    page_name = selected_page.get("name")
    page_id = selected_page.get("id")
    # Este token de página es permanente (nunca expira)
    page_token = selected_page.get("access_token")

    print(f"\n✅ Página seleccionada: '{page_name}' (ID: {page_id})")

    # ── 5. Guardar tokens cifrados en accounts.json ─────────────────────────
    accounts_path = settings.accounts_json_path
    print(f"💾 Guardando tokens cifrados en: {accounts_path}")

    storage = TokenStorage(path=accounts_path, encryption_key=encryption_key)
    
    storage.save_tokens(
        platform="facebook",
        alias="pagina_1",
        access_token=page_token,
        expires_in=None  # Sin expiración para tokens de página permanentes
    )
    
    # Guardar metadata adicional
    storage._data.setdefault("facebook", {}).setdefault("pagina_1", {}).update({
        "name": page_name,
        "target_id": page_id
    })
    storage._save()

    print("\n" + "=" * 65)
    print("🎉 ¡FACEBOOK CONFIGURADO CON ÉXITO!")
    print("=" * 65)
    print(f"   Plataforma : Facebook")
    print(f"   Página     : {page_name}")
    print(f"   Page ID    : {page_id}")
    print(f"   Alias      : pagina_1")
    print(f"   Token      : guardado y cifrado (NUNCA EXPIRA)")
    print()
    print("📝 Próximos pasos:")
    print("   1. Activa en tu .env: ACTIVE_ACCOUNT=facebook:pagina_1")
    print("   2. Ejecuta el pipeline para publicar en tu página de Facebook.")
    print("=" * 65)


if __name__ == "__main__":
    main()
