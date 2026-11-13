"use client";

import { useQuery } from "@tanstack/react-query";
import {
  type ShowcaseCatalog,
  standardShowcaseRepository,
} from "@/features/showcase/api/standard-showcase-repository";

export type CaraCharacter = { id: string; name: string; topic: string; voice: string };

/** El catálogo conserva las identidades y decide cuáles están seleccionadas para el piloto. */
export function caraCharacters(catalog: ShowcaseCatalog): CaraCharacter[] {
  const characters = new Map<string, CaraCharacter>();
  for (const entry of catalog.entries) {
    const data = entry.data as { character?: { identity?: Record<string, unknown> } } | undefined;
    const identity = data?.character?.identity;
    if (entry.kind !== "character" || identity?.piloto_seleccionado !== true) continue;
    if (typeof identity.id !== "string" || typeof identity.nombre !== "string") continue;
    const voice = identity.voz as { nombre?: unknown } | undefined;
    characters.set(identity.id, {
      id: identity.id,
      name: identity.nombre,
      topic: typeof identity.tema === "string" ? identity.tema : "",
      voice: typeof voice?.nombre === "string" ? voice.nombre : "",
    });
  }
  return [...characters.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function useCaraCharacters(enabled: boolean) {
  return useQuery({
    queryKey: ["explainer-cara-characters"],
    queryFn: ({ signal }) => standardShowcaseRepository.catalog("cara-a-cara", signal),
    select: caraCharacters,
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}
