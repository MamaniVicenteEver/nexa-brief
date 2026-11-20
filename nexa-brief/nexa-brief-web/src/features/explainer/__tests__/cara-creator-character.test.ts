import { beforeEach, expect, it, vi } from "vitest";
import type { ShowcaseCatalog } from "@/features/showcase/api/standard-showcase-repository";
import { createProduction } from "../api/explainer-service";
import { caraCharacters } from "../hooks/useCaraCharacters";

const http = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/api/http-client", () => ({
  httpClient: http,
  resolveApiUrl: (url: string) => url,
}));

beforeEach(() => {
  http.mockReset();
  http.mockResolvedValue({
    production_id: "fixture",
    video_id: "fixture-video",
    category_path: "nodeactualidad",
    design: "cara-a-cara",
    topic: "Tema de prueba",
    agent: "claude",
    state: "queued",
    created_at: "2026-11-09",
    updated_at: "2026-11-09",
  });
});

it.each(["alma", "leo", "nara"])(
  "submits selected canonical character %s in multipart JSON",
  async (characterId) => {
    await createProduction({
      categoryPath: "nodeactualidad",
      design: "cara-a-cara",
      characterId,
      topic: "Tema de prueba",
      minutes: 2,
    });
    const [url, request] = http.mock.calls[0];
    expect(url).toBe("/api/v1/explainer/productions");
    expect(request.body).toBeInstanceOf(FormData);
    expect(JSON.parse(request.body.get("payload") as string)).toMatchObject({
      design: "cara-a-cara",
      character_id: characterId,
      minutes: 2,
    });
  },
);

it("rejects missing Cara character before HTTP and leaves other designs unchanged", async () => {
  await expect(
    createProduction({ categoryPath: "nodeactualidad", design: "cara-a-cara", topic: "Tema" }),
  ).rejects.toThrow("Selecciona un personaje");
  expect(http).not.toHaveBeenCalled();
  await createProduction({
    categoryPath: "nodetech",
    design: "otro",
    characterId: "leo",
    topic: "Tema",
  });
  expect(JSON.parse(http.mock.calls[0][1].body.get("payload"))).not.toHaveProperty("character_id");
});

it("reads public pilot identities, excludes former options and deduplicates identity/sprite entries", () => {
  const entry = (id: string, name: string, selected: boolean, voice: string) => ({
    kind: "character",
    data: {
      character: {
        identity: {
          id,
          nombre: name,
          piloto_seleccionado: selected,
          tema: `Tema ${name}`,
          voz: { nombre: voice },
        },
      },
    },
  });
  const catalog = {
    entries: [
      entry("leo", "Leo", true, "Puck"),
      entry("nara", "Nara", true, "Sulafat"),
      entry("alma", "Alma", true, "Sulafat"),
      entry("leo", "Leo", true, "Puck"),
      entry("nora-vega", "Nora Vega", false, "Gacrux"),
      entry("lia", "Lía", false, "Kore"),
    ],
  } as ShowcaseCatalog;
  expect(caraCharacters(catalog)).toEqual([
    { id: "alma", name: "Alma", topic: "Tema Alma", voice: "Sulafat" },
    { id: "leo", name: "Leo", topic: "Tema Leo", voice: "Puck" },
    { id: "nara", name: "Nara", topic: "Tema Nara", voice: "Sulafat" },
  ]);
});
