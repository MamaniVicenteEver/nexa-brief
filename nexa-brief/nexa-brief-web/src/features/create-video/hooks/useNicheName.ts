import { useNiches } from "./useNiches";

/** Human name of a niche id ("lyrics_video_romantic" → "Carta de Amor"); the id itself until niches load. */
export function useNicheName(nicheId: string): string {
  const { data } = useNiches();
  return data?.find((n) => n.id === nicheId)?.displayName ?? nicheId;
}
