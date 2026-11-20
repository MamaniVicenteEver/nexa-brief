"""Fail closed for legacy CLI agents when a v2 profile is selected."""
from __future__ import annotations

from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.ports.agent_port import AgentIsolationUnavailableError


def require_legacy_agent_launch_allowed() -> None:
    """V2 has no verified isolated execution backend yet; no bypass is accepted."""
    if layout_for_settings(settings).schema_version >= 2:
        raise AgentIsolationUnavailableError(
            "Los agentes CLI están deshabilitados para perfiles v2: "
            "no hay un backend de aislamiento verificado instalado."
        )
