"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  type AssetPatch,
  deleteLibraryAsset,
  getLibraryCategories,
  getLyrics,
  retranscribe,
  type UploadAssetInput,
  updateLibraryAsset,
  uploadLibraryAsset,
} from "@/features/library/api/library-assets-service";
import {
  libraryAssetsKey,
  useDebouncedValue,
  useLibraryAssets,
} from "@/features/library/hooks/useLibraryAssets";
import { useRealtimeEvent } from "@/features/realtime";
import { type ResourceKind, toApiKind } from "../kinds";

interface LibraryAssetChangedEvent {
  kind: "images" | "music" | "videos";
  asset_id: string;
  action: "created" | "updated" | "deleted" | "transcription";
  transcription_status: string | null;
}

export const lyricsKey = (assetId: string) => ["library-lyrics", assetId] as const;

/** Mantiene los listados al día con el evento realtime del backend: así el
 * badge de transcripción pasa de "pendiente" a "lista" sin polling, y lo que
 * se sube desde otra pestaña aparece solo. */
export function useLibraryRealtimeSync() {
  const queryClient = useQueryClient();
  useRealtimeEvent<LibraryAssetChangedEvent>("library_asset_changed", (event) => {
    void queryClient.invalidateQueries({ queryKey: libraryAssetsKey(event.kind) });
    void queryClient.invalidateQueries({ queryKey: ["library-categories", event.kind] });
    if (event.kind === "music" && event.transcription_status === "done") {
      void queryClient.invalidateQueries({ queryKey: lyricsKey(event.asset_id) });
    }
  });
}

/** Listado con búsqueda (debounced) y filtro de categoría opcional. */
export function useLibraryList(kind: ResourceKind, q = "", category = "", enabled = true) {
  const apiKind = toApiKind(kind);
  useLibraryRealtimeSync();
  const debouncedQ = useDebouncedValue(q);
  return useLibraryAssets(apiKind, enabled, { q: debouncedQ, category });
}

export function useLibraryCategories(kind: ResourceKind) {
  const apiKind = toApiKind(kind);
  return useQuery({
    queryKey: ["library-categories", apiKind],
    queryFn: ({ signal }) => getLibraryCategories(apiKind, signal),
  });
}

/** Subida con progreso: `progress` va de 0 a 1 mientras `isPending`. */
export function useUploadAsset(kind: ResourceKind) {
  const apiKind = toApiKind(kind);
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const mutation = useMutation({
    mutationFn: (input: UploadAssetInput) => {
      setProgress(0);
      return uploadLibraryAsset(apiKind, input, setProgress);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: libraryAssetsKey(apiKind) });
      void queryClient.invalidateQueries({ queryKey: ["library-categories", apiKind] });
    },
  });
  return { ...mutation, progress };
}

export function useUpdateAsset(kind: ResourceKind) {
  const apiKind = toApiKind(kind);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, patch }: { assetId: string; patch: AssetPatch }) =>
      updateLibraryAsset(apiKind, assetId, patch),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: libraryAssetsKey(apiKind) });
      void queryClient.invalidateQueries({ queryKey: ["library-categories", apiKind] });
    },
  });
}

export function useDeleteAsset(kind: ResourceKind) {
  const apiKind = toApiKind(kind);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) => deleteLibraryAsset(apiKind, assetId),
    onSuccess: (_data, assetId) => {
      queryClient.removeQueries({ queryKey: lyricsKey(assetId) });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: libraryAssetsKey(apiKind) });
      void queryClient.invalidateQueries({ queryKey: ["library-categories", apiKind] });
    },
  });
}

export function useRetranscribe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, language }: { assetId: string; language?: string }) =>
      retranscribe(assetId, language),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: libraryAssetsKey("music") });
    },
  });
}

/** Letra con tiempos por palabra. `enabled` en false mientras no haya letra
 * (el endpoint responde 404 hasta que la transcripción termina). */
export function useLyrics(assetId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: lyricsKey(assetId ?? ""),
    queryFn: ({ signal }) => getLyrics(assetId as string, signal),
    enabled: Boolean(assetId) && enabled,
    retry: false,
  });
}
