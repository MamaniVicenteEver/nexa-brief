import logging
import re
import sys

import structlog

# Tokens que las APIs reciben por query string (Graph API de Facebook, etc.):
# httpx loguea la URL completa de cada request, así que sin esto el token de
# la página quedaba en texto plano en consola y archivos de log.
_SECRET_QUERY_PARAMS = re.compile(
    r"((?:access_token|refresh_token|client_secret|code|key)=)[^&\s\"']+", re.IGNORECASE
)


def _redact_secrets(_logger, _method, event_dict: dict) -> dict:
    for key, value in event_dict.items():
        if isinstance(value, str) and "=" in value:
            event_dict[key] = _SECRET_QUERY_PARAMS.sub(r"\1[REDACTED]", value)
    return event_dict


def setup_logging(level: str = "INFO") -> None:
    """Configure structlog for structured logging with a rich console renderer."""
    log_level = getattr(logging, level.upper(), logging.INFO)

    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="%H:%M:%S"),
        structlog.processors.StackInfoRenderer(),
        _redact_secrets,
    ]

    structlog.configure(
        processors=shared_processors
        + [structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=structlog.dev.ConsoleRenderer(colors=True),
        foreign_pre_chain=shared_processors,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(log_level)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Return a bound structlog logger for the given module name."""
    return structlog.get_logger(name)
