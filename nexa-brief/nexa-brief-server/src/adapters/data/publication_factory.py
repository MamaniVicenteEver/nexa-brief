"""Composition root de los puertos JSON/disco de publicaciones."""

from __future__ import annotations

from dataclasses import dataclass

from src.adapters.data.json_publication_repository import JsonPublicationRepository
from src.adapters.data.local_image_media_cache import LocalImageMediaCache
from src.adapters.data.local_image_post_resources import LocalImagePostResources
from src.adapters.data.local_publication_media import LocalPublicationMedia
from src.adapters.data.licensed_reel_music import LicensedReelMusic
from src.adapters.data.reel_encoder import FfmpegReelEncoder
from src.core.image_posts.repository import ImagePostRepository
from src.core.image_posts.service import ImagePostService


@dataclass(frozen=True)
class PublicationComponents:
    port: JsonPublicationRepository
    media: LocalPublicationMedia
    image_cache: LocalImageMediaCache
    resources: LocalImagePostResources
    repository: ImagePostRepository
    service: ImagePostService


_components: PublicationComponents | None = None


def build_publication_components(
    *, data_dir=None, plan_builder=None, renderer=None, publisher=None, account_provider=None
) -> PublicationComponents:
    port = JsonPublicationRepository(data_dir=data_dir)
    media = LocalPublicationMedia(data_dir=data_dir)
    image_cache = LocalImageMediaCache(data_dir=data_dir)
    music_catalog = LicensedReelMusic(data_dir=data_dir)
    resources = LocalImagePostResources(data_dir=data_dir)
    repository = ImagePostRepository(port)
    service = ImagePostService(
        repository, media, plan_builder=plan_builder, renderer=renderer, publisher=publisher,
        account_provider=account_provider, material_source=resources, account_mapping=resources,
        style_catalog=resources, image_cache=image_cache,
        music_catalog=music_catalog, reel_encoder=FfmpegReelEncoder(),
    )
    return PublicationComponents(
        port=port, media=media, image_cache=image_cache, resources=resources,
        repository=repository, service=service,
    )


def get_publication_components() -> PublicationComponents:
    global _components
    if _components is None:
        _components = build_publication_components()
    return _components


def set_publication_components(components: PublicationComponents | None) -> None:
    """Inyección de fakes en pruebas y herramientas locales."""
    global _components
    _components = components
