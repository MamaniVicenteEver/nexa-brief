"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getLibraryAsset,
  type LibraryAsset,
  resolveAssetFileUrl,
} from "@/features/library/api/library-assets-service";
import type { Draft } from "../types";

const METADATA_CONCURRENCY = 2;
const LOOKUP_CONCURRENCY = 3;
const AUDIO_TIMEOUT_MS = 15_000;
const durationKey = (id: string) => ["prototype-audio-duration", id] as const;
const validDuration = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/** Lee duración de audio sólo cuando la biblioteca no la conoce. */
export function usePrototypeSongDurations(
  drafts: (Draft | null)[],
  songs: LibraryAsset[] | undefined,
  songsLoading: boolean,
): Record<string, number> {
  const client = useQueryClient();
  const [, refresh] = useState(0);
  const ids = Array.from(
    new Set(
      drafts.map((draft) => draft?.inputs?.musicAssetId).filter((id): id is string => Boolean(id)),
    ),
  ).sort();
  const known = new Map((songs ?? []).map((song) => [song.assetId, song]));
  const absent = ids.filter((id) => !known.has(id));
  const absentKey = JSON.stringify(absent);
  const lookup = useQuery({
    queryKey: ["prototype-song-lookup", absentKey],
    enabled: absent.length > 0 && !songsLoading,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const result: Record<string, LibraryAsset> = {};
      const pending: string[] = JSON.parse(absentKey);
      const worker = async () => {
        while (pending.length && !signal.aborted) {
          const id = pending.shift();
          if (!id) continue;
          try {
            result[id] = await getLibraryAsset("music", id, signal);
          } catch {
            // El archivo puede haber sido eliminado. Las demás canciones siguen disponibles.
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(LOOKUP_CONCURRENCY, pending.length) }, worker),
      );
      return result;
    },
  });

  const durations: Record<string, number> = {};
  const fallback: string[] = [];
  for (const id of ids) {
    const asset = known.get(id) ?? lookup.data?.[id];
    const seconds = asset?.durationSeconds;
    if (validDuration(seconds)) {
      durations[id] = seconds;
    } else {
      const cached = client.getQueryData<number | null>(durationKey(id));
      if (validDuration(cached)) durations[id] = cached;
      if (!songsLoading && (known.has(id) || (!lookup.isFetching && lookup.isFetched)))
        fallback.push(id);
    }
  }
  const fallbackKey = JSON.stringify(fallback);

  useEffect(() => {
    const pending: string[] = (JSON.parse(fallbackKey) as string[]).filter(
      (id) => client.getQueryData(durationKey(id)) === undefined,
    );
    const active = new Set<() => void>();
    let cancelled = false;

    const start = () => {
      while (!cancelled && active.size < METADATA_CONCURRENCY && pending.length) {
        const id = pending.shift();
        if (!id) continue;
        const audio = new Audio();
        let done = false;
        let timeout: ReturnType<typeof setTimeout>;
        const cleanup = () => {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          audio.removeEventListener("loadedmetadata", loaded);
          audio.removeEventListener("error", failed);
          audio.removeAttribute("src");
          audio.load();
          active.delete(cleanup);
        };
        const finish = (duration: number | null) => {
          cleanup();
          if (cancelled) return;
          client.setQueryData(durationKey(id), duration);
          refresh((value) => value + 1);
          start();
        };
        const loaded = () => finish(validDuration(audio.duration) ? audio.duration : null);
        const failed = () => finish(null);
        active.add(cleanup);
        audio.addEventListener("loadedmetadata", loaded);
        audio.addEventListener("error", failed);
        timeout = setTimeout(failed, AUDIO_TIMEOUT_MS);
        audio.preload = "metadata";
        audio.src = resolveAssetFileUrl("music", id);
      }
    };
    start();
    return () => {
      cancelled = true;
      for (const cleanup of active) cleanup();
    };
  }, [client, fallbackKey]);

  return durations;
}
