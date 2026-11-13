"""Publishing adapters package.

Exports the main facade and factory for use by the pipeline and API layer.
"""

from src.adapters.publishing.publisher_facade import PublisherFacade
from src.adapters.publishing.factory import get_publisher_facade

__all__ = ["PublisherFacade", "get_publisher_facade"]
