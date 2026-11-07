# Image preview fonts

These WOFF2 files are lossless format conversions of the verified TTF assets in
the parent directory. They preserve every glyph, Unicode mapping and advance;
they are not subsets. The existing font licenses in `../licenses/` still apply.

Only editable image previews use these files. JPEG exports and video renderers
continue loading the original TTF assets. The preview verifies the source and
WOFF2 SHA256 hashes from `manifest.json`; a new font without a compressed entry
uses its original verified TTF automatically.

To rebuild on a development machine with `fonttools[woff]` installed:

```sh
python src/skills/image_posts/styles/build_preview_fonts.py
```

Commit the generated WOFF2 assets and manifest together when a maintainer chooses
to commit a font update. The server does not need fonttools or Brotli installed.
Run the image preview pixel-equivalence tests after rebuilding; full glyph and
metric round-trip checks are also performed by the builder.
