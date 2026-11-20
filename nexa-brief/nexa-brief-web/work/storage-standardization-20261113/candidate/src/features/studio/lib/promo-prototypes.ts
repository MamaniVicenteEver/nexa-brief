import type { PromoSession } from "../api/promo-service";
import type { TemplateStudioController } from "../hooks/useTemplateStudio";

/** A session is one prototype, regardless of how many draft revisions it owns. */
export function promoPrototypeGroups(
  sessions: PromoSession[],
  prototypes: TemplateStudioController["prototypes"],
  archivedDraftIds: string[] = [],
) {
  const uniqueSessions = Array.from(new Map(sessions.map((session) => [session.session_id, session])).values());
  const linked = new Set([...archivedDraftIds, ...uniqueSessions.flatMap((session) => [session.draft_id, ...(session.draft_history ?? [])].filter((id): id is string => Boolean(id)))]);
  const legacy = prototypes.filter((draft) => !linked.has(draft.draftId));
  return { sessions: uniqueSessions, legacy, count: uniqueSessions.length + legacy.length };
}
