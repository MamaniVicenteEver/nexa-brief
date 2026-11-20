# NodeMotion shared engines

Start with [the architecture](../../../../docs/nodemotion-architecture.md) and [catalog.json](catalog.json). Read only the selected design's QUICK.md, catalog and component contract.

- promo/designs/<design-id>/ owns promo document fragments, runtime and discovery.
- lyrics/designs/<design-id>/ owns lyric document fragments, runtime and discovery.
- shared/assemble.py assembles canonical HTML and freezes immutable revisions.
- shared/discovery.py exposes component metadata without reading entire engines.
- shared/resources/ stores hash-addressed demo media and fonts, shared across designs.
- promo/production/ owns production guides, versioned prompts and contracts.
- promo/tools/ and promo/compiler/ own preparation and design compilation.
- lyrics/compiler/ owns existing lyric family build sources.

Application strategies, resource validation and recording materialization live in [src/core/nodemotion](../../../core/nodemotion/). Keep promo behavior in promo/, lyric behavior in lyrics/, and common behavior in shared/.

Episodes store JSON and Resources references. Preview resolves virtual HTML and media URLs. Recording materializes a temporary isolated export. Do not copy engines or media into every episode.

Keep stable design/resource/transport IDs. Preserve colors, fonts, movement, transitions, timing, composition and exact source media during structural changes. Revision archives preserve historical executions; they are not a second editable engine.

The public demo folders remain compatible entry points with data and logical URL aliases. Demo resources are served from the shared hash store and can be registered in Resources without copying the media.

For reusable design creation, start with [template authoring](../../../../docs/nodemotion-template-authoring.md) and [AGENTS.md](AGENTS.md). Episode preparation is separate.
