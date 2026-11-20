"use client";

import { useQuery } from "@tanstack/react-query";
import type { ShowcaseRepository } from "../api/showcase-repository";
import type { Design, Selection } from "../types";

export const showcaseKeys = {
  designs: ["showcase", "designs"] as const,
  library: (fingerprint: string) => ["showcase", "library", fingerprint] as const,
  catalog: (id: string, fingerprint: string) => ["showcase", "catalog", id, fingerprint] as const,
};
export function fingerprintDesigns(designs: Design[]): string {
  return JSON.stringify(designs.map(({ id, family, scripts }) => [id, family, scripts]));
}
const repositoryIds = new WeakMap<ShowcaseRepository, number>();
let nextRepositoryId = 0;
function repositoryId(repo: ShowcaseRepository): number {
  let id = repositoryIds.get(repo);
  if (id === undefined) {
    id = ++nextRepositoryId;
    repositoryIds.set(repo, id);
  }
  return id;
}
export function useShowcaseDesigns(repo: ShowcaseRepository) {
  const identity = repositoryId(repo);
  return useQuery({
    queryKey: [...showcaseKeys.designs, identity],
    queryFn: ({ signal }) => repo.getDesigns(signal),
  });
}
export function useShowcaseData(repo: ShowcaseRepository, selection: Selection) {
  const identity = repositoryId(repo);
  const designs = useShowcaseDesigns(repo);
  const entries = designs.data ?? [];
  const fingerprint = fingerprintDesigns(entries);
  const library = useQuery({
    queryKey: [...showcaseKeys.library(fingerprint), identity],
    queryFn: ({ signal }) => repo.getLibrary(entries, signal),
    enabled: designs.isSuccess && selection.kind === "videos",
  });
  const designId = selection.kind === "design" ? selection.id : "";
  const catalog = useQuery({
    queryKey: [...showcaseKeys.catalog(designId, fingerprint), identity],
    queryFn: ({ signal }) => repo.getCatalog(designId, { designs: entries }, signal),
    enabled:
      designs.isSuccess &&
      selection.kind === "design" &&
      entries.some((entry) => entry.id === designId),
  });
  const active = selection.kind === "videos" ? library : catalog;
  return {
    designs,
    library,
    catalog,
    items: active.data ?? [],
    retryActive: () => {
      if (designs.isError) void designs.refetch();
      else void active.refetch();
    },
  };
}
