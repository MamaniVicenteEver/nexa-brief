from pathlib import Path

from src.core.library import sound_library
from src.core.ports.sound_effects_port import CuratedSoundMetadata, SoundCandidate


class LibrarySoundRepository:
    def search(self, query):
        return sound_library.search_sounds(q=query, approved_only=True)

    def get(self, asset_id):
        return sound_library.get_sound(asset_id)

    def path(self, asset_id):
        return sound_library.resolve_sound_path(asset_id)

    def find_by_provider(self, provider, sound_id):
        return next(
            (e for e in sound_library.search_sounds() if e.provider == provider and e.provider_sound_id == sound_id),
            None,
        )

    async def register(self, source: Path, candidate: SoundCandidate, metadata: CuratedSoundMetadata):
        return await sound_library.register_sound(
            source,
            title=metadata.title,
            description=metadata.description,
            recommended_uses=metadata.recommended_uses,
            tags=", ".join(metadata.tags),
            provider=candidate.provider,
            provider_sound_id=candidate.provider_sound_id,
            original_url=candidate.source_url,
            license_note=candidate.license_note,
            license_url=candidate.license_url,
            approval_status="pending",
            source="auto",
        )

    async def mark_used(self, asset_id):
        await sound_library.mark_sound_used(asset_id)
