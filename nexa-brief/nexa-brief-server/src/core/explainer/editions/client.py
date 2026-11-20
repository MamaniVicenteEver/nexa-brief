"""Small private-API client. It never opens profiles, model tools or credentials."""
from __future__ import annotations

import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

DEFAULT_API_URL = "http://127.0.0.1:8000/api/v1"
_IDENTIFIER = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}\Z")
_LOCALE = re.compile(r"[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*\Z")
_ALIASES = {"es": "es-419", "en": "en-US", "pt": "pt-BR"}


class APIClientError(RuntimeError):
    def __init__(self, message, *, status=None):
        super().__init__(message)
        self.status = status


def identifier(value):
    if not isinstance(value, str) or not _IDENTIFIER.fullmatch(value):
        raise ValueError("ID inválido: usa letras, números, guiones o guiones bajos (máximo 128)")
    return quote(value, safe="")


def locale_code(value):
    if not isinstance(value, str):
        raise ValueError("Idioma inválido")
    value = _ALIASES.get(value.lower(), value)
    if not _LOCALE.fullmatch(value) or len(value) > 20:
        raise ValueError("Idioma inválido: usa es, en, pt o un código como en-US")
    return value


def safe_error(value):
    if isinstance(value, dict):
        value = value.get("detail") or value.get("message") or "La API rechazó la operación"
    if not isinstance(value, str):
        return "La API rechazó la operación; consulta preflight/status"
    value = re.sub(r"[\x00-\x1f\x7f]", " ", value)
    value = re.sub(r"(?i)\bBearer\s+\S+", "Bearer [redactado]", value)
    value = re.sub(r"(?i)\b(token|password|secret|api[_-]?key|authorization)\s*[:=]\s*\S+", r"\1=[redactado]", value)
    value = re.sub(r"(?<!\w)/(?:home|root|tmp|var|etc|srv|opt|mnt|media|Users)/[^\s\"'<>]+", "[ruta privada]", value)
    return value[:600]


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        raise APIClientError("La API redirigió la solicitud; usa su dirección privada autorizada explícita")


class EditionClient:
    def __init__(self, base_url=DEFAULT_API_URL, *, timeout=15):
        parsed = urlsplit(base_url)
        if (parsed.scheme not in {"http", "https"} or not parsed.hostname
                or parsed.username is not None or parsed.password is not None or parsed.query or parsed.fragment):
            raise ValueError("URL de API inválida; no incluyas credenciales, consulta ni fragmento")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.opener = build_opener(_NoRedirect())

    def request(self, method, path, payload=None, *, timeout=None):
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = Request(self.base_url + path, data=data, method=method,
                          headers={"Accept": "application/json", "Content-Type": "application/json"})
        try:
            with self.opener.open(request, timeout=self.timeout if timeout is None else timeout) as response:
                raw = response.read(1024 * 1024 + 1)
            if len(raw) > 1024 * 1024:
                raise APIClientError("La respuesta de la API excede el tamaño permitido")
            try:
                value = json.loads(raw)
            except (ValueError, UnicodeDecodeError) as exc:
                raise APIClientError("La API no devolvió JSON válido") from exc
            if not isinstance(value, dict):
                raise APIClientError("La API devolvió una respuesta inesperada")
            return value
        except HTTPError as exc:
            if exc.code in {401, 403}:
                raise APIClientError("La API requiere acceso autorizado. Usa una sesión o proxy autorizado; no desactives su autenticación.", status=exc.code) from exc
            try:
                detail = safe_error(json.loads(exc.read(8192)))
            except (ValueError, UnicodeDecodeError):
                detail = "La API rechazó la operación"
            raise APIClientError(f"HTTP {exc.code}: {detail}", status=exc.code) from exc
        except (URLError, TimeoutError, OSError) as exc:
            raise APIClientError("No se pudo confirmar la respuesta de la API privada; consulta list/status antes de repetir una creación") from exc

    def preflight(self, video_id, locale):
        return self.request("GET", f"/explainer/videos/{identifier(video_id)}/localizations/{quote(locale_code(locale), safe='')}/preflight")

    def create(self, video_id, locale):
        return self.request("POST", f"/explainer/videos/{identifier(video_id)}/localizations", {"locale": locale_code(locale)})

    def list(self, video_id):
        return self.request("GET", f"/explainer/videos/{identifier(video_id)}/localizations")

    def status(self, job_id, *, timeout=None):
        return self.request("GET", f"/explainer/localization-jobs/{identifier(job_id)}", timeout=timeout)

    def resume(self, job_id):
        return self.request("POST", f"/explainer/localization-jobs/{identifier(job_id)}/resume")
