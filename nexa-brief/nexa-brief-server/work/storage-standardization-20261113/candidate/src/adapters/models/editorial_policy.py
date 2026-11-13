"""Explicit availability-only fallback for the user's editorial model preference."""
from src.core.ports.agent_port import AgentIsolationUnavailableError


def codex_fallback_allowed(*, result=None, error=None):
    if isinstance(error, (AgentIsolationUnavailableError, FileNotFoundError, ConnectionError)):
        return True
    text = str(error or "") + " " + str(getattr(result, "last_message", "") or "")
    text = text.casefold()
    return any(marker in text for marker in (
        "codex_unavailable", "agent_unavailable", "usage limit", "usage_limit",
        "quota exceeded", "insufficient_quota", "quota_exceeded", "rate limit",
        "rate_limit", "model_not_found", "model not found", "model unavailable",
        "model is not available", "not logged in", "authentication required",
    ))
