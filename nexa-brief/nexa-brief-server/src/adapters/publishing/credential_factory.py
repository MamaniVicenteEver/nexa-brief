"""Credential provider seam. Local tokens stay encrypted when moved to another provider."""

from src.config.settings import settings
from src.adapters.data.provider_registry import build_provider


def build_credential_store(*, path, encryption_key, implementation=None):
    if settings.credentials_backend == "encrypted_json":
        if implementation is None:
            from src.adapters.publishing.token_storage import TokenStorage

            implementation = TokenStorage
        return implementation(path=path, encryption_key=encryption_key)
    return build_provider("credentials", settings.credentials_backend, encryption_key=encryption_key)
