# NodeMotion architecture

## Ownership and source tree

NodeMotion separates application workflows from reusable design engines. Stable template IDs and public API identifiers remain the contract.

```text
src/core/nodemotion/
├── service.py                 Public project facade
├── contracts.py / factory.py  Project strategy contract and family selection
├── shared/
│   ├── execution.py           Project validation, resolution and materialization
│   ├── resources.py            Hash-checked library assets and transcription snapshots
│   ├── content.py              Preview content and revision-scoped URLs
│   ├── migration.py            Profile project migration
│   ├── retirement.py           Separately gated retirement of verified legacy copies
│   ├── workspace_names.py      Hash-planned English workspace filename migration
│   └── bundled.py              Bundled demo-media planner and resolver
├── lyrics/
│   ├── project.py              Lyric project strategy
│   └── appearance.py           Project appearance overrides
└── promo/                      Research, prompts, pipeline, readiness, reports and review

src/templates/_tools/nodemotion/
├── shared/
│   ├── assemble.py             Canonical HTML/runtime registry and immutable revisions
│   ├── discovery.py            Derived catalogs and component contracts
│   ├── extract.py              Lossless extraction and integrity check
│   └── resources/<sha256>.<ext> Content-addressed demo-source media
├── promo/
│   ├── designs/<stable-id>/    Shared promo design sources and discovery contracts
│   ├── compiler/               Promo build, media grading and standalone rendering
│   ├── tools/                  Promo CLI and draft/workflow tools
│   └── production/
│       ├── GUIDE.md
│       ├── OPERATE.md
│       ├── QUALITY.md
│       ├── prompts/             Versioned prompt source and active mapping
│       ├── schemas/
│       └── templates/           Per-promo production contracts
└── lyrics/
    ├── designs/<stable-id>/    Shared lyric design sources and discovery contracts
    └── compiler/<family>/      Existing family build specs and source helpers
```

The routing skill is [src/skills/nodemotion/promo/SKILL.md](../src/skills/nodemotion/promo/SKILL.md). The English production guides are maintained under [src/templates/_tools/nodemotion/promo/production](../src/templates/_tools/nodemotion/promo/production/). Do not create per-project copies of these guides, prompts or design engines.

## Shared design engines

Each registered design has a manifest with its stable design ID, original demo location, ordered document fragments, legacy runtime URL aliases and integrity hashes. The canonical HTML skeleton is `document.html`; ordered inline scripts and styles are stored under `scripts/` and `styles/`; external JS, CSS and HTML runtime pieces live under `runtime/`.

The shared assembler joins these sources without reformatting or reordering visual code. Design catalogs, contracts and `QUICK.md` are derived from the existing authoritative template/configuration metadata and component definitions. They describe what is known; they do not replace the design configuration as a second source of truth.

The promo compiler updates registered designs through the shared assembler's `update_engine` API and refreshes discovery metadata. It does not write generated source into a thin demo `index.html`. The demo remains an entry point; its data and public ID remain stable. Lyrics family build specifications live under `lyrics/compiler/<family>/`.

The extraction report records byte-exact equivalence for 35 registered HTML documents and 103 external runtime files. The per-design SHA-256 comparison is in `/tmp/nodemotion-final-engine-integrity.json`. See [validation evidence](nodemotion-validation.md) for the scope and limits of that result.

## Profile projects and shared resources

Projects store authored data, library references and the selected engine policy. They do not keep another copy of the registered engine or library media. A typical promo project is:

```text
<profile>/productions/nodemotion/<project-id>/
├── project.json               Design ID, resource references and engine policy
├── assets/
│   ├── config.json            Project configuration and overrides
│   └── timeline.json          Promo-authored timeline, when applicable
├── appearance.json            Optional lyric appearance override
├── work/                       Preparation state and authored materials
├── logs/                       Project workflow evidence
└── manifest.json              Packaging metadata when produced
```

The layout varies by workflow. A project manifest points to profile library resources by asset ID and SHA-256; project JSON does not embed the media bytes. Resolution checks the recorded hash and fails if that resource revision is unavailable. User-provided or downloaded media stay in the profile's `resources/{music,images,videos}/<asset-id>/` library. Derived audio tails and posters are content-addressed runtime cache entries, not edited source assets.

The canonical repository store for shared demo-source media is `src/templates/_tools/nodemotion/shared/resources/<sha256>.<ext>`. The completed 2026-11-14 relocation maps each original demo-relative URL in the design manifest to its hash-named source: 839 original demo files were retired after verification, and 733 identical common resources were linked. The apply result is recorded in `/tmp/nodemotion-demo-resources-result.json`. `register_bundled_resource` records a library origin and profile asset ID pointing to the same bundled hash; it does not copy bytes into each project. Do not confuse bundled demo defaults with user-uploaded media in the profile library.

Lyric transcription snapshots are content-addressed JSON under `<profile>/resources/nodemotion/transcriptions/<sha256>.json`. A lyric project may refer to a snapshot and its source music ID. A promo timeline is campaign-owned authored content. It is passed through `promo_timeline` and stored as the project's `assets/timeline.json`; it is never written to the music transcription cache.

## Workspace filenames

New writes use English names: `work/script.json`, `work/instructions/`, `work/reports/` and `REPORT.md`. The promo reader can still read legacy `work/guion.json` and the prompt resolver can read the legacy Spanish instructions path. `workspace_names.py` builds a JSON rename plan with per-tree SHA-256 values, refuses destination conflicts and blocks projects whose operational JSON still points to a path being renamed. It renames known paths atomically and does not rewrite historical text or archived file references. The profile run applied 112 workspace renames across 44 sandbox projects and verified matching before/after tree hashes.

### Legacy demo URL maps

Some existing demo documents fetch data at paths embedded in their HTML. `project.json` may preserve these public URL paths with:

- `data_urls`: original URL paths for configuration and timing JSON, the audio resource and optional visual background. Audio/background resolve through declared, hash-checked resource references.
- `extra_data_urls`: additional project-local JSON files fetched by the original document. Each path is validated, stays inside the project and is served only when declared.

A promo design may still request its old `assets/lyrics.json` URL via `lyricsUrl`. For a NodeMotion promo project, that legacy URL resolves to the authored promo timeline stored canonically at `assets/timeline.json`; it does not resolve to the soundtrack transcription or its cache. This URL alias preserves the demo's fetch contract.

These maps let the resolver preserve a design's existing fetch contract without copying code or exposing arbitrary private project files. Ordinary projects use their content prefix (normally `assets/`) and the same resolver. Preview URLs freeze the engine revision and scope relative requests to that revision.

## Execution and review flow

```text
Promo pipeline or lyric strategy
        |
        v
Validate authored config/timeline and hash-checked resource references
        |
        v
Write project.json and project-owned JSON
        |
        v
Resolve one immutable engine revision for the execution
        |
        +--> Preview: virtual HTML, JSON and media responses
        |
        +--> Recorder: temporary materialization -> recorder adapter -> encoder
        |
        +--> Packaging: validate the same resolved project and resources
```

The public facade is `src/core/nodemotion/service.py`; preview and recording share the project resolver. Recording materializes the canonical engine and declared project resources into a temporary destination. It does not create a persistent engine copy inside the project.

Promo approval applies to an exact session revision and content fingerprint. A new revision or changed content invalidates that approval and returns the project to review. Approval does not start recording or publication.

## Immutable revisions

New projects can use `stable` or `pinned` engine policy. Stable projects resolve the current canonical engine at each execution; each preview or recording freezes one revision for the duration of that operation. Pinned projects keep an archived engine revision in `project.json`. Engine updates archive the previous canonical document and runtime before publishing the replacement. Historical pinned revisions remain resolvable.

Resource references are also revisioned by content hash. Transcription snapshots are immutable and content-addressed. Missing engine or resource revisions fail explicitly rather than silently substituting current content.

## Profile migration

Profile migration was authorized with the full-profile backup explicitly excluded. The 2026-11-14 final apply completed recognized projects in `/home/alfred/.local/share/nexa-brief/profiles/profesional`: 108 were already migrated and 29 native-demo projects were migrated, for 137 completed projects. Twelve unidentified projects remain preserved for review; their roots and reasons are listed in [validation evidence](nodemotion-validation.md). All 137 completed projects have complete retirement journals, recording 5,102 retired legacy files. The migration implementation is in `src/core/nodemotion/shared/migration.py`, with its offline dry-run/apply entry point at `src/templates/_tools/nodemotion/shared/migrate_projects.py`. It supports profile schema v3, identifies designs from explicit metadata or exact engine content, maps media to library IDs and hashes, archives legacy engines, stages canonical projects and verifies resolved output before publishing manifests.

Retirement of verified legacy copies is a separate operation from migration. The final run completed retirement for the 137 recognized projects; the 12 needs-review projects remain preserved. No full-profile backup was made, as explicitly directed.

Bundled demo-media relocation uses the offline planner at `src/core/nodemotion/shared/bundled.py`. The reviewed plan was applied and verified: hash-named shared media and design URL aliases were published, then only listed original paths were retired. The operation retired 839 original demo files and linked 733 identical common resources, as recorded in `/tmp/nodemotion-demo-resources-result.json`. It does not call external media services or register profile Resource records; the library registers bundled media on demand.

Campaign migration is a separate operation and completed for all 24 planned campaign workspaces; 335 files were retired and no workspace needed review. Post-apply verification byte-checked 383 campaign virtual paths, confirmed the workspaces remain hidden from UI cards, and confirmed 19 session rows were unchanged. The plan included 96 immutable poster files. Migration uses `resources.variant_file` to preserve ready-file bytes and the existing asset ID, and marks migrated workspaces `workspace_only`. Apply is guarded by source metadata and a read snapshot. Results are recorded in `/tmp/nodemotion-campaign-live-result.json` and `/tmp/nodemotion-campaign-live-verification.json`.

## HTTP and discovery

The template API exposes canonical source and design component discovery:

- `GET /api/v1/templates/<id>/source`
- `GET /api/v1/templates/<id>/components`
- `GET /api/v1/templates/<id>/components/<component-id>`

The existing showcase, draft preview and temporary preview routes keep their IDs and resolve shared engine sources. Both project preview routes use the same resolver for revision-scoped HTML, JSON and byte-range media. The local media server also resolves original demo URLs and legacy runtime aliases.

Agent workflows read the production guide and the selected design's `QUICK.md`/component contract, then write project data. Engine changes require a separate, explicit design change.

## Validation commands

Run from the server checkout:

```sh
.venv/bin/python src/templates/_tools/nodemotion/shared/extract.py --check
.venv/bin/python -m pytest tests/unit/test_nodemotion_engines.py tests/unit/test_nodemotion_execution.py tests/unit/test_nodemotion_http.py tests/unit/test_nodemotion_integration_contracts.py tests/unit/test_nodemotion_migration.py tests/unit/test_nodemotion_retirement.py -q
.venv/bin/python src/templates/_tools/hyperframes/optimize.py --check lyrics-trazo promo-editorial
```

A full-suite number requires a named run and its log. Existing baseline failures are recorded separately. The evidence sheet records the completed migration for identified projects; it does not claim migration of the 12 unidentified projects or complete render coverage.

For reusable design creation, follow [template authoring](nodemotion-template-authoring.md). Episode preparation uses the existing project workflow.
