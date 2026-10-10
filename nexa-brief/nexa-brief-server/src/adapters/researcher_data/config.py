"""Configuración aislada de ``researcher_data``.

Las variables se leen desde ``src/adapters/researcher_data/.env``. No se
mezclan con ``src.config.settings`` para que este adaptador pueda probarse y
activarse por separado del resto del servidor.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ADAPTER_DIR = Path(__file__).resolve().parent


class ResearcherSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ADAPTER_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Cliente HTTP compartido por todos los proveedores.
    researcher_user_agent: str = Field(
        default="NexaBriefResearcher/0.1 (contact: configure RESEARCHER_USER_AGENT)",
        alias="RESEARCHER_USER_AGENT",
    )
    request_timeout_seconds: float = Field(
        default=30.0, alias="RESEARCHER_REQUEST_TIMEOUT_SECONDS"
    )
    request_max_retries: int = Field(default=2, alias="RESEARCHER_REQUEST_MAX_RETRIES")
    request_retry_backoff_seconds: float = Field(
        default=0.6, alias="RESEARCHER_REQUEST_RETRY_BACKOFF_SECONDS"
    )
    max_parallel_requests: int = Field(
        default=6, alias="RESEARCHER_MAX_PARALLEL_REQUESTS"
    )
    cache_ttl_seconds: int = Field(default=900, alias="RESEARCHER_CACHE_TTL_SECONDS")

    # Wikipedia / MediaWiki.
    wikipedia_language: str = Field(default="en", alias="WIKIPEDIA_LANGUAGE")
    wikipedia_api_url: str = Field(
        default="https://en.wikipedia.org/w/api.php", alias="WIKIPEDIA_API_URL"
    )
    wikipedia_rest_url: str = Field(
        default="https://en.wikipedia.org/w/rest.php/v1", alias="WIKIPEDIA_REST_URL"
    )

    # Wikidata y Wikimedia Commons.
    wikidata_api_url: str = Field(
        default="https://www.wikidata.org/w/api.php", alias="WIKIDATA_API_URL"
    )
    wikidata_sparql_url: str = Field(
        default="https://query.wikidata.org/sparql", alias="WIKIDATA_SPARQL_URL"
    )
    commons_api_url: str = Field(
        default="https://commons.wikimedia.org/w/api.php",
        alias="WIKIMEDIA_COMMONS_API_URL",
    )

    # Wikimedia Enterprise: credenciales para obtener el JWT y token opcional
    # ya emitido. Nunca se solicita login automáticamente durante una búsqueda.
    wikimedia_enterprise_auth_url: str = Field(
        default="https://auth.enterprise.wikimedia.com",
        alias="WIKIMEDIA_ENTERPRISE_AUTH_URL",
    )
    wikimedia_enterprise_api_url: str = Field(
        default="https://api.enterprise.wikimedia.com",
        alias="WIKIMEDIA_ENTERPRISE_API_URL",
    )
    wikimedia_enterprise_username: str = Field(
        default="", alias="WIKIMEDIA_ENTERPRISE_USERNAME"
    )
    wikimedia_enterprise_password: str = Field(
        default="", alias="WIKIMEDIA_ENTERPRISE_PASSWORD"
    )
    wikimedia_enterprise_access_token: str = Field(
        default="", alias="WIKIMEDIA_ENTERPRISE_ACCESS_TOKEN"
    )
    wikimedia_enterprise_refresh_token: str = Field(
        default="", alias="WIKIMEDIA_ENTERPRISE_REFRESH_TOKEN"
    )
    wikimedia_enterprise_project: str = Field(
        default="enwiki", alias="WIKIMEDIA_ENTERPRISE_PROJECT"
    )

    # Openverse: el token es opcional para las búsquedas públicas.
    openverse_api_url: str = Field(
        default="https://api.openverse.org/v1", alias="OPENVERSE_API_URL"
    )
    openverse_api_token: str = Field(default="", alias="OPENVERSE_API_TOKEN")

    # Library of Congress.
    loc_api_url: str = Field(
        default="https://www.loc.gov", alias="LIBRARY_OF_CONGRESS_API_URL"
    )

    # Europeana.
    europeana_api_url: str = Field(
        default="https://api.europeana.eu/record/v2", alias="EUROPEANA_API_URL"
    )
    europeana_api_key: str = Field(default="", alias="EUROPEANA_API_KEY")

    # NASA APIs y NASA Image & Video Library.
    nasa_api_url: str = Field(default="https://api.nasa.gov", alias="NASA_API_URL")
    nasa_api_key: str = Field(default="DEMO_KEY", alias="NASA_API_KEY")
    nasa_images_api_url: str = Field(
        default="https://images-api.nasa.gov", alias="NASA_IMAGES_API_URL"
    )

    # World Bank Indicators API.
    world_bank_api_url: str = Field(
        default="https://api.worldbank.org/v2", alias="WORLD_BANK_API_URL"
    )

    # OpenStreetMap API y Overpass. El User-Agent anterior se envía a ambos.
    openstreetmap_api_url: str = Field(
        default="https://api.openstreetmap.org/api/0.6", alias="OPENSTREETMAP_API_URL"
    )
    overpass_api_url: str = Field(
        default="https://overpass-api.de/api/interpreter", alias="OVERPASS_API_URL"
    )
    overpass_fallback_api_url: str = Field(
        default="https://overpass.kumi.systems/api/interpreter",
        alias="OVERPASS_FALLBACK_API_URL",
    )
    overpass_default_bbox: str = Field(default="", alias="OVERPASS_DEFAULT_BBOX")

    # Digital Public Library of America.
    dpla_api_url: str = Field(default="https://api.dp.la/v2", alias="DPLA_API_URL")
    dpla_api_key: str = Field(default="", alias="DPLA_API_KEY")

    # Internet Archive: catálogo y archivos públicos, sin API key.
    internet_archive_api_url: str = Field(
        default="https://archive.org", alias="INTERNET_ARCHIVE_API_URL"
    )


@lru_cache(maxsize=1)
def get_settings() -> ResearcherSettings:
    return ResearcherSettings()


settings = get_settings()
