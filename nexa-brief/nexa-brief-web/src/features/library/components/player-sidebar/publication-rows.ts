import type { ChannelPlatform } from "@/features/channels";
import type { QueueEntry, QueueStatus } from "@/features/schedule";
import type { JobPublication } from "../../api/job-deletion-service";

export interface PublicationRow {
  key: string;
  platform: ChannelPlatform;
  accountAlias: string;
  format: string | null;
  status: QueueStatus;
  url: string | null;
  date: string | null;
  error: string | null;
}

const VISIBLE: QueueStatus[] = ["published", "publishing", "failed", "queued"];

/** Una fila por cuenta y formato: la publicación lograda si la hay, si no el
 * último intento (así los reintentos fallidos no llenan la lista). Lo que solo
 * figura en el registro de publicados (sin entrada en la cola) se suma al final. */
export function buildPublicationRows(
  entries: QueueEntry[],
  publications: JobPublication[],
): PublicationRow[] {
  const byTarget = new Map<string, QueueEntry>();
  const sorted = entries
    .filter((entry) => VISIBLE.includes(entry.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const entry of sorted) {
    const target = `${entry.platform}:${entry.accountAlias}:${entry.format ?? ""}`;
    const current = byTarget.get(target);
    if (current?.status === "published" && entry.status !== "published") continue;
    byTarget.set(target, entry);
  }

  const rows: PublicationRow[] = [...byTarget.values()].map((entry) => ({
    key: entry.entryId,
    platform: entry.platform,
    accountAlias: entry.accountAlias,
    format: entry.format ?? null,
    status: entry.status,
    url: entry.url,
    date: entry.processedAt ?? entry.scheduledAt ?? entry.updatedAt,
    error: entry.status === "failed" ? entry.error : null,
  }));

  const knownPosts = new Set(entries.map((entry) => entry.postId).filter(Boolean));
  for (const publication of publications) {
    if (knownPosts.has(publication.postId)) continue;
    rows.push({
      key: `${publication.platform}:${publication.accountAlias}:${publication.postId}`,
      platform: publication.platform,
      accountAlias: publication.accountAlias,
      format: null,
      status: "published",
      url: publication.url,
      date: null,
      error: null,
    });
  }
  return rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** "16x9" → "16:9". */
export function formatLabel(format: string): string {
  return format.replace("x", ":");
}
