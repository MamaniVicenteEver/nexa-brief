# NodeMotion validation evidence

## Status

The profile project migration, bundled demo-media relocation, and campaign migration have been applied. The profile run completed 137 projects and preserved 12 unidentified projects for review. Campaign migration completed all 24 planned workspaces, retired 335 files, verified 383 virtual paths byte-for-byte, and left 19 session rows unchanged. The full-profile backup was explicitly excluded. The completed full-suite snapshot below predates the final compiler-source installation and two resolver-test corrections. A 35-test targeted correction set passed afterward; no full-suite rerun was recorded after those changes. The counts below are not an all-green result.

## Recorded test runs

| Run | Result | Evidence and limits |
|---|---:|---|
| Original repository baseline | 137 failed, 2,649 passed, 2 skipped | `/tmp/nodemotion-baseline-tests.log`; 392.68 s. This is the pre-refactor baseline. |
| Full live-code run before the latest corrections | 155 failed, 2,828 passed, 2 skipped | `/tmp/nodemotion-live-final-tests.log`; 447.24 s. This predates later fixes and is not the current full-suite result. |
| Completed full-suite snapshot before final source installation | 147 failed, 2,956 passed, 2 skipped | `/tmp/nodemotion-completed-suite.log` and `/tmp/nodemotion-completed-suite.xml`; 521.42 s, 12 warnings. It is not an all-green run and predates the final compiler-source and resolver-test updates. Name-by-name comparison against the original baseline found 11 failures absent from that run and one baseline failure that no longer occurred, for a net increase of 10 failed tests. |
| Final focused NodeMotion set | 287 passed | `/tmp/nodemotion-final-focused.log`; focused engine, execution, migration, retirement, HTTP, native-demo, profile and workspace-name coverage. |
| Campaign tool tests | 65 passed | `/tmp/nodemotion-campaign-final-live-tests.log`; focused coverage only. |
| Scene-contract regression subset after compiler-source installation | 16 passed | `/tmp/nodemotion-final-regressions.log`; focused result, not a full-suite replacement. |
| Final correction set | 35 passed | `/tmp/nodemotion-final-corrections-tests.log`; 1.43 s, targeted after the final source and resolver-test corrections. |
| Bundled demo focused set | 18 passed, 1 failed | `/tmp/nodemotion-bundled-live-tests.log`. The remaining failure is the known baseline editorial-thumbnail expectation for decorative role elements (`test_editorial_renderer_keeps_copy_short_and_never_adds_lyrics_labels`). |

Focused selections may overlap, so their counts are not added together. The 11 failures absent from the original baseline included 10 NodeMotion failures that were corrected afterward: eight came from ignored compiler build sources, fixed by installing 30 authored files and adding scoped NodeMotion ignore exceptions; two were stale resolver-test expectations, then corrected. The remaining new failure was a Tabloid font timeout already seen in the older live run. One original-baseline dynamic `generalizar` failure no longer occurred, leaving a net increase of 10 failed tests in the snapshot. The final correction set passed, but the full-suite snapshot predates those changes. No claim is made that all tests pass.

## Engine integrity and visual evidence

- The final integrity comparison reports byte-exact SHA-256 matches for 35 registered design HTML documents and 103 external runtime files. The report is `/tmp/nodemotion-final-engine-integrity.json`; the check is `src/templates/_tools/nodemotion/shared/extract.py --check`.
- Reported visual comparisons: Editorial and lyrics-trazo were exact; lyrics-latido had a small clock-only variation. Capture files and comparison command were not attached, so the visual artifacts still need to be attached before treating this as a review package.
- One reported clip render completed at 1920×1080 with H.264 video and AAC audio. Its command, artifact path and playback review were not included. This is one render sample, not proof of every format, duration or encoder path.

## Profile and workspace migration

The final apply to `/home/alfred/.local/share/nexa-brief/profiles/profesional` recorded 149 project roots: 108 `already-migrated`, 29 `migrated` from native demo entries, and 12 `needs-review`. The 12 review cases were preserved. Their IDs and reasons are:

- No explicit or exact matching design identity: `22484535`, `2eb2d236`, `daaa02cc`, `232f0226`, `d0cde5c7`, `35652c87`.
- Sandbox prototype requires registered design reconciliation: `lyrics-final-cut`, `promo-fuerza-motivacion`.
- Missing safe `index.html`: `ab8098d6`, `73cbf499`, `341c6bf3`.
- Job output has no registered draft or HTML entry: `8364343a`.

All 137 completed projects have completed retirement journals, recording 5,102 retired legacy files. No full-profile backup was made, as explicitly directed.

The hash-planned English workspace rename applied 112 path renames across 44 sandbox projects with matching before/after tree hashes. New writes use `work/script.json`, `work/instructions/`, `work/reports/` and `REPORT.md`; the reader retains explicit read compatibility for legacy `work/guion.json` and the old Spanish instructions path. The production [GUIDE](../src/templates/_tools/nodemotion/promo/production/GUIDE.md) and [OPERATE](../src/templates/_tools/nodemotion/promo/production/OPERATE.md) docs show English paths for new work and identify legacy paths as compatibility fallbacks.

The migration supports profile schema v3, identifies known designs from explicit metadata or exact engine content, maps media by library ID and hash, stages canonical projects and verifies resolved output before publishing manifests. The 12 review cases remain untouched pending review.

## Bundled demo-media relocation

The offline apply completed. Its result at `/tmp/nodemotion-demo-resources-result.json` records 839 original demo files retired and 733 identical common resources linked into the shared store. This operation applies to repository demo media, separately from the user profile library.

## Campaign migration

The separate campaign migration completed all 24 planned workspaces with 0 needs-review cases. It retired 335 files. The post-apply verification at `/tmp/nodemotion-campaign-live-verification.json` checked bytes for all 383 campaign virtual paths, confirmed the workspaces are hidden from UI cards, and confirmed 19 existing session rows were unchanged. The migration plan covered 96 immutable poster files.

Campaign resource migration uses `resources.variant_file` to preserve the existing ready-file bytes and asset ID. Poster files remain immutable, migrated workspaces use `workspace_only` to avoid new UI cards, and apply checks source metadata and a read snapshot. The apply result is `/tmp/nodemotion-campaign-live-result.json`.

## Corrections recorded during implementation

- Promo timelines are passed in `promo_timeline` and stored as authored project timelines, separate from music transcription snapshots.
- Promo content, readiness and preview paths resolve JSON-only projects through the NodeMotion project service; they do not require a persistent physical `index.html` or a transcription-cache timeline.
- The promo compiler uses shared engine update/runtime resolution so extracted runtime assets resolve from the canonical registry and registered demo entry files remain thin.
- New authored work uses English paths. Spanish workspace paths are read-compatibility fallbacks, not the write location.
- The bundled demo focused run still records the named editorial-thumbnail baseline failure; no claim is made that every focused or full test selection is green.

## Pending evidence

- Keep the full-suite snapshot and its baseline comparison tied to the exact source revision; the recorded full-suite totals predate the final targeted corrections.
- Attach the remaining visual captures and comparison command. The per-design byte-integrity report is already recorded.
- Record the rendered clip path, render command and playback review.
- Resolve the 12 preserved needs-review project roots based on their recorded reasons; they remain untouched until reviewed.
