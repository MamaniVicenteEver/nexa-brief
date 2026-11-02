from functools import lru_cache

from src.adapters.sound_effects.ffmpeg_mixer import FFmpegSoundMixer
from src.adapters.sound_effects.library import LibrarySoundRepository
from src.adapters.sound_effects.metadata_curator import AgentSoundMetadataCurator
from src.adapters.sound_effects.sfxmint import SFXMintAdapter
from src.core.sound_design.service import SoundDesignService


@lru_cache(maxsize=1)
def build_service() -> SoundDesignService:
    return SoundDesignService(
        LibrarySoundRepository(), SFXMintAdapter(), AgentSoundMetadataCurator(), FFmpegSoundMixer()
    )
