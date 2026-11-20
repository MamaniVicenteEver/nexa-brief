"""Build lossless WOFF2 copies for image previews; original TTF assets stay intact.

Developer command (fonttools[woff] is required only on the build machine):
    python build_preview_fonts.py

No glyph subsetting or font metric changes are performed. The runtime verifies
both source and output hashes and falls back to the original TTF for new fonts.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


def main() -> None:
    import fontTools
    from fontTools.ttLib import TTFont

    root = Path(__file__).resolve().parent
    destination = root / "fonts/preview"
    destination.mkdir(parents=True, exist_ok=True)
    sources = {}
    for path in sorted(root.glob("node_*.json")):
        style = json.loads(path.read_text(encoding="utf-8"))
        for asset in style["fonts"]["font_assets"]:
            sources[asset["sha256"]] = asset
    rows = []
    for source_hash, asset in sorted(sources.items()):
        source = root / asset["path"]
        if hashlib.sha256(source.read_bytes()).hexdigest() != source_hash:
            raise ValueError(f"Source hash mismatch: {asset['path']}")
        target = destination / (source.stem + ".woff2")
        font = TTFont(source, recalcTimestamp=False, recalcBBoxes=False)
        font.flavor = "woff2"
        font.save(target, reorderTables=False)
        # Round-trip verification covers every glyph, Unicode mapping and advance.
        converted = TTFont(target, recalcTimestamp=False, recalcBBoxes=False)
        if (
            font.getGlyphOrder() != converted.getGlyphOrder()
            or font.getBestCmap() != converted.getBestCmap()
            or font["hmtx"].metrics != converted["hmtx"].metrics
            or font["head"].unitsPerEm != converted["head"].unitsPerEm
        ):
            raise ValueError(f"Font metrics changed: {asset['path']}")
        content = target.read_bytes()
        rows.append(
            {
                "source_path": asset["path"],
                "source_sha256": source_hash,
                "preview_path": target.name,
                "sha256": hashlib.sha256(content).hexdigest(),
                "bytes": len(content),
                "glyphs": len(font.getGlyphOrder()),
                "license": asset["license"],
                "license_url": asset["license_url"],
            }
        )
    (destination / "manifest.json").write_text(
        json.dumps(
            {
                "schema_version": 1,
                "format": "woff2",
                "fonttools_version": fontTools.__version__,
                "fonts": rows,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Built {len(rows)} full-glyph WOFF2 assets ({sum(row['bytes'] for row in rows):,} bytes).")


if __name__ == "__main__":
    main()
