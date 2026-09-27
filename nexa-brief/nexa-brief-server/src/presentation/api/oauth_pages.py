"""HTML pages shown in the browser at the end of an OAuth flow (success / error).

Kept out of the routers so the look can change without touching OAuth logic.
Every dynamic value is HTML-escaped: `error`, `error_description` and upstream
response bodies come straight from the query string / third parties.
"""

from __future__ import annotations

import json
from html import escape
from urllib.parse import quote

from src.config.settings import settings

_REDIRECT_SECONDS = 6

_PLATFORMS: dict[str, dict[str, str]] = {
    "youtube": {
        "label": "YouTube",
        "color": "#FF0033",
        "icon": '<path fill="#fff" d="M9 6.8v10.4l8.4-5.2z"/>',
    },
    "tiktok": {
        "label": "TikTok",
        "color": "#111111",
        "icon": (
            '<path fill="#fff" d="M14.5 5.5c.4 1.6 1.6 2.8 3.2 3v2.3a5.6 5.6 0 0 1-3.2-1v4.7a4.2 4.2 0 1 1-4.2-4.2'
            'c.2 0 .5 0 .7.1v2.4a1.9 1.9 0 1 0 1.2 1.7V5.5z"/>'
        ),
    },
    "facebook": {
        "label": "Facebook",
        "color": "#1877F2",
        "icon": (
            '<path fill="#fff" d="M13.2 19v-6h2l.3-2.4h-2.3V9.1c0-.7.2-1.1 1.2-1.1h1.2V5.9a16 16 0 0 0-1.8-.1'
            'c-1.8 0-3 1.1-3 3.1v1.7H8.8V13h2V19z"/>'
        ),
    },
}

_STYLES = """
:root{--bg:#efede8;--bg2:#e5e2da;--surface:#f7f4ed;--ink:#0d0d10;--soft:#2a2a2d;--mute:#8a8780;
--line:#dad6c9;--green:#bfd58f;--green-dark:#5c7838;--red:#c2362b}
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:grid;place-items:center;padding:24px 16px;color:var(--ink);
font-family:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;
background:radial-gradient(1200px 600px at 50% -10%,#fff8e6 0%,transparent 60%),
linear-gradient(180deg,var(--bg) 0%,var(--bg2) 100%)}
.brand{position:fixed;top:22px;left:28px;font-weight:800;font-size:17px;letter-spacing:-.02em}
.card{width:100%;max-width:440px;background:var(--surface);border-radius:26px;padding:34px 30px 26px;
box-shadow:0 30px 60px -24px rgba(40,30,10,.25),0 10px 20px -8px rgba(40,30,10,.08),inset 0 1px 0 rgba(255,255,255,.8);
animation:rise .5s cubic-bezier(.2,.8,.2,1) both}
@keyframes rise{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
.hero{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px}
.avatar{position:relative;width:76px;height:76px}
.avatar img,.avatar .ph{width:76px;height:76px;border-radius:50%;object-fit:cover;background:var(--bg2);
display:grid;place-items:center;font-weight:800;font-size:28px;color:var(--soft);box-shadow:0 0 0 4px var(--surface),0 0 0 5px var(--line)}
.badge{position:absolute;right:-4px;bottom:-4px;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;
box-shadow:0 0 0 3px var(--surface)}
.badge svg{width:18px;height:18px}
.status{display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:999px;font-size:12px;font-weight:600}
.status.ok{background:rgba(191,213,143,.35);color:var(--green-dark)}
.status.err{background:rgba(194,54,43,.1);color:var(--red)}
.status i{width:7px;height:7px;border-radius:50%;background:currentColor}
.status.ok i{animation:pulse 1.8s ease-in-out infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(92,120,56,.45)}50%{box-shadow:0 0 0 5px rgba(92,120,56,0)}}
h1{font-size:23px;font-weight:800;letter-spacing:-.025em;line-height:1.2}
.sub{font-size:13.5px;color:var(--mute);line-height:1.5}
.sub b{color:var(--soft);font-weight:600}
.rows{margin-top:24px;border:1px solid var(--line);border-radius:16px;overflow:hidden}
.row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;font-size:13px}
.row+.row{border-top:1px solid var(--line)}
.row span{color:var(--mute)}
.row strong{font-weight:600;text-align:right}
.msg{margin-top:22px;font-size:13.5px;line-height:1.6;color:var(--soft);text-align:center}
details{margin-top:14px;font-size:12px;color:var(--mute)}
summary{cursor:pointer;text-align:center;list-style:none;user-select:none}
summary::-webkit-details-marker{display:none}
summary:hover{color:var(--soft)}
pre{margin-top:10px;padding:12px 14px;border-radius:12px;background:var(--bg2);color:var(--soft);
font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word}
.actions{margin-top:24px;display:flex;flex-direction:column;gap:10px}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;height:46px;border-radius:999px;
font-size:14px;font-weight:600;text-decoration:none;cursor:pointer;border:0;font-family:inherit;transition:transform .15s,background .15s}
.btn:active{transform:scale(.98)}
.primary{background:var(--ink);color:#fafaf7}
.primary:hover{background:#26262b}
.ghost{background:transparent;color:var(--soft);border:1px solid var(--line)}
.ghost:hover{background:rgba(0,0,0,.03)}
.timer{margin-top:14px;text-align:center;font-size:12px;color:var(--mute)}
.timer button{background:none;border:0;color:var(--soft);font:inherit;font-weight:600;text-decoration:underline;cursor:pointer}
.bar{height:3px;border-radius:3px;background:var(--line);overflow:hidden;margin-top:10px}
.bar i{display:block;height:100%;background:var(--green-dark);transform-origin:left;animation:fill linear forwards}
@keyframes fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.icon-err{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:rgba(194,54,43,.1)}
.icon-err svg{width:30px;height:30px;stroke:var(--red)}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
"""


def _channels_url(query: str = "") -> str:
    return f"{settings.frontend_url.rstrip('/')}/canales{query}"


def _platform(platform: str) -> dict[str, str]:
    return _PLATFORMS.get(platform, {"label": platform.capitalize(), "color": "#0d0d10", "icon": ""})


def _page(title: str, body: str, script: str = "") -> str:
    return f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)} · Nexa Brief</title><style>{_STYLES}</style></head>
<body><div class="brand">Nexa Brief</div>{body}{script}</body></html>"""


def _format_expiry(expires_in: int | None) -> str:
    if not expires_in or expires_in <= 0:
        return "Permanente"
    minutes = round(expires_in / 60)
    if minutes < 90:
        return f"{minutes} min"
    hours = round(expires_in / 3600)
    return f"{hours} h" if hours < 48 else f"{round(hours / 24)} días"


def render_oauth_success(
    platform: str,
    alias: str,
    *,
    name: str | None = None,
    avatar: str | None = None,
    expires_in: int | None = None,
    has_refresh_token: bool = False,
    extra_accounts: int = 0,
) -> str:
    meta = _platform(platform)
    display_name = name or alias
    initial = escape(display_name[:1].upper() or "?")
    avatar_html = (
        f'<img src="{escape(avatar)}" alt="" referrerpolicy="no-referrer">'
        if avatar
        else f'<div class="ph">{initial}</div>'
    )
    renewal = "Automática" if has_refresh_token else ("No necesaria" if not expires_in else "Manual")
    extra_row = (
        f'<div class="row"><span>Páginas adicionales</span><strong>+{extra_accounts} conectadas</strong></div>'
        if extra_accounts
        else ""
    )
    target = _channels_url(f"?connected={quote(f'{platform}:{alias}')}")

    body = f"""
<main class="card" role="main">
  <div class="hero">
    <div class="avatar">{avatar_html}
      <div class="badge" style="background:{meta['color']}"><svg viewBox="0 0 24 24">{meta['icon']}</svg></div>
    </div>
    <span class="status ok"><i></i>Cuenta conectada</span>
    <h1>{escape(display_name)}</h1>
    <p class="sub">Tu cuenta de <b>{escape(meta['label'])}</b> quedó vinculada a Nexa Brief<br>
    y ya puede recibir publicaciones automáticas.</p>
  </div>
  <div class="rows">
    <div class="row"><span>Plataforma</span><strong>{escape(meta['label'])}</strong></div>
    <div class="row"><span>Alias interno</span><strong>{escape(alias)}</strong></div>
    <div class="row"><span>Vigencia del token</span><strong>{_format_expiry(expires_in)}</strong></div>
    <div class="row"><span>Renovación</span><strong>{renewal}</strong></div>
    {extra_row}
  </div>
  <div class="actions">
    <a class="btn primary" href="{escape(target)}">Ir a Canales</a>
  </div>
  <div class="timer" id="timer">Te llevamos a Canales en <b id="sec">{_REDIRECT_SECONDS}</b> s ·
    <button type="button" id="stay">Quedarme aquí</button>
    <div class="bar"><i style="animation-duration:{_REDIRECT_SECONDS}s"></i></div>
  </div>
  <details><summary>Detalles técnicos</summary>
    <pre>Selector de cuenta: {escape(platform)}:{escape(alias)}
Tokens cifrados en accounts.json</pre>
  </details>
</main>"""

    script = f"""<script>
(function(){{var s={_REDIRECT_SECONDS},el=document.getElementById('sec'),t=setInterval(function(){{
s--;el.textContent=s;if(s<=0){{clearInterval(t);location.href={_js_string(target)};}}}},1000);
document.getElementById('stay').onclick=function(){{clearInterval(t);document.getElementById('timer').remove();}};
}})();</script>"""
    return _page(f"{meta['label']} conectado", body, script)


def render_oauth_error(title: str, message: str, *, detail: str | None = None, platform: str | None = None) -> str:
    label = _platform(platform)["label"] if platform else None
    detail_html = (
        f"<details><summary>Ver detalle técnico</summary><pre>{escape(detail)}</pre></details>" if detail else ""
    )
    eyebrow = f"No se pudo conectar {escape(label)}" if label else "No se pudo completar la conexión"
    body = f"""
<main class="card" role="main">
  <div class="hero">
    <div class="icon-err"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round">
      <path d="M12 8v5M12 16.5v.01"/><circle cx="12" cy="12" r="9"/></svg></div>
    <span class="status err"><i></i>{eyebrow}</span>
    <h1>{escape(title)}</h1>
  </div>
  <p class="msg">{escape(message)}</p>
  {detail_html}
  <div class="actions">
    <a class="btn primary" href="{escape(_channels_url())}">Volver a Canales</a>
  </div>
</main>"""
    return _page(title, body)


def _js_string(value: str) -> str:
    return json.dumps(value).replace("</", "<\\/")
