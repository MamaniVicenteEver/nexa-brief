# NodeMotion module rules

- Keep promo-specific behavior under promo/, lyric-specific behavior under lyrics/, common execution under shared/.
- Shared engines and production assets live under src/templates/_tools/nodemotion/.
- Use English filenames; preserve stable template, video, resource and transport identifiers.
- Preserve all existing colors, fonts, animation, transitions, timings, composition and media during refactoring.
- Projects contain data and references; do not copy engines or registered media into each project.
- Promo scripts/timelines are campaign-owned, never music transcription cache entries.
- Preserve immutable resource and engine revisions for previews, recording and historical projects.
- Read docs/nodemotion-architecture.md and run execution, discovery, transport and recorder tests.

For creating reusable designs, read [template authoring](../../../docs/nodemotion-template-authoring.md). Keep one shared engine per design; reuse service/factory and distinguish design authoring from episode preparation.
