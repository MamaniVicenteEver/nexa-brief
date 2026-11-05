/** Only information needed to summarize a pending publication per account. */
export interface PendingChannelPublication {
  id: string;
  platform: string;
  alias: string;
  scheduledAt: string | null;
}

export interface ChannelQueueSummary {
  count: number;
  earliest: string | null;
}

/** JSON encoding prevents collisions even if an alias contains a separator. */
export function channelKey(platform: string, alias: string): string {
  return JSON.stringify([platform, alias]);
}

/** Pages may overlap when new queue entries arrive while paging. */
export function summarizeChannelQueue(
  entries: PendingChannelPublication[],
): Map<string, ChannelQueueSummary> {
  const result = new Map<string, ChannelQueueSummary>();
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    const key = channelKey(entry.platform, entry.alias);
    const current = result.get(key) ?? { count: 0, earliest: null };
    current.count++;
    const stamp = entry.scheduledAt ? Date.parse(entry.scheduledAt) : Number.NaN;
    if (Number.isFinite(stamp) && (!current.earliest || stamp < Date.parse(current.earliest))) {
      current.earliest = new Date(stamp).toISOString();
    }
    result.set(key, current);
  }
  return result;
}
