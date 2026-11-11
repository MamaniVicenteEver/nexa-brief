from types import SimpleNamespace
from src.adapters.models import hub
from src.adapters.models.editorial_policy import codex_fallback_allowed
from src.core.ports.agent_port import AgentIsolationUnavailableError


def test_preferred_editorial_models_are_explicit():
    cfg = hub.roles_config()
    for role in ("producer", "script", "text_draft", "dialogue_draft", "copy_draft", "copy"):
        assert cfg["roles"][role]["provider"] == "codex"
        assert cfg["roles"][role]["model"] == "gpt-6.1-terra"
        assert cfg["roles"][role]["reasoning_effort"] == "high"
    assert cfg["editorial_policy"]["alternative"] == {
        "provider": "codex", "model": "gpt-6-luna", "reasoning_effort": "max",
        "note": "Máximo solicitado por el usuario: max; no reducir a xhigh."}


def test_claude_is_only_allowed_for_actual_codex_unavailability_or_quota():
    assert codex_fallback_allowed(error=AgentIsolationUnavailableError("not verified"))
    for message in ("Usage limit reached", "quota exceeded", "model_not_found", "codex_unavailable"):
        assert codex_fallback_allowed(result=SimpleNamespace(last_message=message))
    for message in ("", "The script is incorrect", "invalid_json: missing title", "failed with code 4"):
        assert not codex_fallback_allowed(result=SimpleNamespace(last_message=message))
    assert not codex_fallback_allowed(error=ValueError("bad editorial output"))


def test_legacy_brief_also_exports_instagram_copy():
    from src.core.explainer.briefs import ExplainerBrief
    brief = ExplainerBrief(video_id="test", working_title="Idea", hook="¿Pregunta?", angle="Simple", thesis="Clara",
        youtube={"title":"Título", "description":"Descripción breve"},
        facebook={"title":"Título social", "description":"Descripción social"},
        tiktok={"caption":"Título corto"})
    copy = brief.to_publish_json()
    assert copy["instagram_title"] == "Título social"
    assert copy["instagram_description"] == "Descripción social"
