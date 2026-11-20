"""Paquete de publicación de los videos explainer (publish.json v2).

Módulos:
  strategies   carga las estrategias de src/skills/explainer/ (datos, no código)
  package      el modelo de publish.json v2
  description  arma las descripciones de YouTube y Facebook desde los bloques
  numbers      cifras en dígitos o en palabras, para verificar promesas
  checks       valida el paquete contra las estrategias y el video real
  opening      la miniatura elegida abre el video (beat 0) y es la captura de la miniatura
  store        lee/escribe publish.json y deriva los campos planos de v1
  service      revisar y reconstruir un video (lo usan la API y la CLI)

Diseño: docs/investigaciones/integracion-estrategias-explainer-2026-10.md.
"""

from src.core.explainer.publishing.checks import Issue
from src.core.explainer.publishing.package import PublishPackage
from src.core.explainer.publishing.service import PackageReview, build, review

__all__ = ["Issue", "PackageReview", "PublishPackage", "build", "review"]
