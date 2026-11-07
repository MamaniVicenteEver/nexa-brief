import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent } from "@/features/realtime";
import { httpClient } from "@/infrastructure/api/http-client";
import type { PendingChannelPublication } from "../lib/channel-insights";

const QUERY_KEY = ["dashboard-channel-queue"] as const;
const PAGE_SIZE = 200;
const MAX_PAGES = 2;
interface QueuePage {
  total: number;
  entries: {
    entry_id: string;
    platform: string;
    account_alias: string;
    scheduled_at: string | null;
  }[];
}
export interface ChannelQueueSnapshot {
  entries: PendingChannelPublication[];
  complete: boolean;
}

/** Fetch a bounded snapshot: never label partial queue counts or dates as complete. */
export async function getChannelQueue(signal?: AbortSignal): Promise<ChannelQueueSnapshot> {
  const entries: PendingChannelPublication[] = [];
  const seen = new Set<string>();
  let expectedTotal: number | null = null;
  let stable = true;
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await httpClient<QueuePage>(
      `/api/v1/schedule/queue?status=queued&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
      { signal },
    );
    if (expectedTotal !== null && expectedTotal !== response.total) stable = false;
    expectedTotal = response.total;
    for (const item of response.entries) {
      if (seen.has(item.entry_id)) continue;
      seen.add(item.entry_id);
      entries.push({
        id: item.entry_id,
        platform: item.platform,
        alias: item.account_alias,
        scheduledAt: item.scheduled_at,
      });
    }
    if (response.entries.length < PAGE_SIZE || entries.length >= response.total) {
      return { entries, complete: stable && entries.length === response.total };
    }
  }
  return { entries, complete: false };
}

export function useChannelQueue() {
  const client = useQueryClient();
  useRealtimeEvent("queue_entry_changed", () => {
    client.invalidateQueries({ queryKey: QUERY_KEY });
  });
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ signal }) => getChannelQueue(signal),
    refetchInterval: 60_000,
    retry: 1,
  });
}
