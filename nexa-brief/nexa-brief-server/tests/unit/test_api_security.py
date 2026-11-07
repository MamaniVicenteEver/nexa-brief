from __future__ import annotations

from fastapi import HTTPException
from fastapi.testclient import TestClient

from src.config.settings import settings
from src.presentation.api.security import require_internal, sign_link, verify_link
from src.presentation.main import app
from src.presentation.api import security


def test_require_internal_allows_local_development_once_without_token(monkeypatch) -> None:
    calls: list[str] = []
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "nexa_internal_token", "")
    monkeypatch.setattr(security, "_dev_warning_logged", False)
    monkeypatch.setattr(security.logger, "warning", lambda event, **_: calls.append(event))

    require_internal(None)
    require_internal(None)

    assert calls == ["nexa_internal_token_missing_in_development"]


def test_require_internal_denies_unconfigured_production(monkeypatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "nexa_internal_token", "")

    try:
        require_internal(None)
    except HTTPException as error:
        assert error.status_code == 503
    else:
        raise AssertionError("production without an internal token must fail closed")


def test_require_internal_compares_token_in_constant_time(monkeypatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "nexa_internal_token", "server-secret")

    for supplied in (None, "wrong"):
        try:
            require_internal(supplied)
        except HTTPException as error:
            assert error.status_code == 403
        else:
            raise AssertionError("missing or invalid internal token must be rejected")

    assert require_internal("server-secret") is None


def test_protected_sandbox_routes_require_internal_token(monkeypatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "nexa_internal_token", "server-secret")

    client = TestClient(app)
    assert client.get("/api/v1/explainer/sandbox/nope/nope/thumbnail.jpg").status_code == 403
    assert client.get(
        "/api/v1/explainer/sandbox/referencias/nodehistory/nope/thumbnail.jpg"
    ).status_code == 403
    assert client.post("/api/v1/explainer/sandbox/nope/nope/promote").status_code == 403

    headers = {"X-Nexa-Internal": "server-secret"}
    assert client.get("/api/v1/explainer/sandbox/nope/nope/thumbnail.jpg", headers=headers).status_code == 404
    assert client.post("/api/v1/explainer/sandbox/nope/nope/promote", headers=headers).status_code == 404


def test_signed_link_is_bound_to_path_and_expiration(monkeypatch) -> None:
    monkeypatch.setattr(settings, "nexa_link_secret", "link-secret")
    monkeypatch.setattr(security.time, "time", lambda: 1_000)

    signed = sign_link("/api/v1/agent/prototipo/nodehistory/idea", ttl=60)
    assert verify_link("/api/v1/agent/prototipo/nodehistory/idea", signed)
    assert not verify_link("/api/v1/agent/prototipo/nodehistory/other", signed)
    assert not verify_link("/api/v1/agent/prototipo/nodehistory/idea", signed + "x")

    monkeypatch.setattr(security.time, "time", lambda: 1_061)
    assert not verify_link("/api/v1/agent/prototipo/nodehistory/idea", signed)


def test_sign_link_requires_path_ttl_and_secret(monkeypatch) -> None:
    monkeypatch.setattr(settings, "nexa_link_secret", "")
    try:
        sign_link("/valid", ttl=30)
    except RuntimeError:
        pass
    else:
        raise AssertionError("signing without NEXA_LINK_SECRET must fail")

    monkeypatch.setattr(settings, "nexa_link_secret", "link-secret")
    for path, ttl in (("relative", 30), ("/valid", 0)):
        try:
            sign_link(path, ttl)
        except ValueError:
            pass
        else:
            raise AssertionError("invalid link arguments must fail")
