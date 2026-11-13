"""Foreground host entrypoint sharing the existing heavy preparation budget."""
from pathlib import Path
import sys
import os

sys.path.insert(0, str(Path(__file__).resolve().parents[5]))

from edition_context import EditionContext
from src.core.explainer.runtime import heavy_tool_slot


def main():
    if os.environ.get("NEXA_EXPLAINER_PIPELINE_AGENT") == "1":
        raise SystemExit("Las herramientas de edición corresponden al host")
    command, flag, edition_path = sys.argv[1:]
    if command not in {"voice", "transcribe", "outro"} or flag != "--edition":
        raise SystemExit("Uso: edition_job.py voice|transcribe|outro --edition edition.json")
    ctx = EditionContext(edition_path)
    with heavy_tool_slot(command):
        if command == "voice":
            import narrate
            sys.argv = [str(Path(__file__).with_name("narrate.py")), str(ctx.path_of("script")), str(ctx.path_of("audio").with_suffix("")),
                        "--edition", edition_path, "--no-qc"]
            narrate.main()
        elif command == "transcribe":
            import transcribe
            transcribe.main(str(ctx.path_of("audio")), str(ctx.path_of("script")), str(ctx.path_of("lyrics")), ctx)
        else:
            import outro
            if outro.spec_for_edition(ctx) is None:
                outro.make_voice(ctx)
            if outro.apply(ctx.production, ctx) is None:
                raise RuntimeError("No se pudo agregar el cierre del idioma")


if __name__ == "__main__":
    main()
