"""Select the project family for a registered NodeMotion design."""
from src.core.nodemotion.contracts import ProjectStrategy
from src.core.nodemotion.lyrics.project import LyricsProject
from src.core.nodemotion.promo.project import PromoProject
from src.templates._tools.nodemotion.shared.assemble import design_manifest


def get_project_strategy(design_id: str) -> ProjectStrategy:
    family = design_manifest(design_id)["family"]
    if family == "lyrics":
        return LyricsProject()
    if family == "promo":
        return PromoProject()
    raise ValueError(f"Unsupported NodeMotion family: {family}")
