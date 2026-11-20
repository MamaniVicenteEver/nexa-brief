"""Resource ownership and provenance, independent of HTTP and persistence."""
from __future__ import annotations
from functools import lru_cache
from src.core.ports.resource_context_port import ResourceContextPort
from pydantic import BaseModel, Field, model_validator

class ResourceOrigin(BaseModel):
    category_id: str
    category_name: str
    template_id: str = ""
    template_name: str = ""

class ResourceMetadata(BaseModel):
    display_name: str = ""
    category_id: str = ""
    category_name: str = ""
    template_id: str = ""
    template_name: str = ""
    resource_origins: list[ResourceOrigin] = Field(default_factory=list)

    @model_validator(mode="after")
    def infer_display_name(self):
        # Registros antiguos no requieren una migración para recibir un nombre.
        if not self.display_name:
            self.display_name = next((str(value) for field in
                ("label", "track_name", "title", "original_filename")
                if (value := getattr(self, field, ""))), "")
        return self

@lru_cache(maxsize=1)
def context_port() -> ResourceContextPort:
    # Composition root; replace the adapter without changing consumers.
    from src.adapters.library.resource_context import TemplateResourceContext
    return TemplateResourceContext()

def resource_metadata(category: str = "", template_id: str = "") -> dict:
    origin = context_port().resolve(category, template_id)
    return {**origin.model_dump(), "resource_origins": [origin.model_dump()]} if origin else {}

def category_key(value: str) -> str:
    return "".join(c for c in value.casefold() if c.isalnum())

def belongs_to(entry: ResourceMetadata, category: str) -> bool:
    target = category_key(category)
    origins = entry.resource_origins
    return any(category_key(value) == target for value in (
        entry.category_id, entry.category_name, *(o.category_id for o in origins),
        *(o.category_name for o in origins), getattr(entry, "category", ""),
    ) if value)
