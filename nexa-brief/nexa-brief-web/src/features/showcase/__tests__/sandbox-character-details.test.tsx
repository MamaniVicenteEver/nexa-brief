import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  CharacterTechnical,
  CharacterVoice,
  useCharacterDetails,
} from "../components/SandboxCharacterDetails";
import { type CatalogSprite, readSprites, type SandboxCatalog } from "../lib/sandbox-catalog";

const catalog: SandboxCatalog = {
  base: "sandbox/nodeaction/_vida",
  components: "showcase/components.json",
  gallery: "showcase.html",
};
const item: CatalogSprite = {
  name: "Tomás",
  file: "tomas.png",
  characterFile: "characters/tomas.json",
  voiceSample: {
    file: "sandbox/nodeaction/vida-en-escena/assets/audio/lines/L02.wav",
    text: "Hola",
    source: "Una muestra",
  },
};
const character = {
  id: "tomas",
  voice: "tomas",
  height: 1,
  hair: { style: "spiky", color: "#61412c" },
};
function View({ sprite }: { sprite: CatalogSprite }) {
  const details = useCharacterDetails("sandbox/nodeaction/vida-en-escena", catalog, sprite);
  return (
    <>
      <CharacterVoice item={sprite} details={details} />
      <CharacterTechnical details={details} />
    </>
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("muestra datos reales, perfil y audio asociado; al cambiar de personaje carga su propio perfil", async () => {
  const fetcher = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.endsWith("characters/tomas.json")
        ? character
        : url.endsWith("characters/nico.json")
          ? { id: "nico", voice: "nico" }
          : url.endsWith("voices/tomas.json")
            ? { voice: "Achird", language: "es-419", model: "tts", approved: false }
            : { voice: "Fenrir", language: "es-419", approved: true },
  }));
  vi.stubGlobal("fetch", fetcher);
  const view = render(<View sprite={item} />);
  expect((await screen.findByText(/Pendiente de aprobación/)).textContent).toContain("Achird");
  expect(screen.getByText("spiky · #61412c")).toBeTruthy();
  expect(screen.getByLabelText("Escuchar voz de Tomás").getAttribute("src")).toContain(
    "/files/sandbox/nodeaction/vida-en-escena/assets/audio/lines/L02.wav",
  );
  const audio = screen.getByLabelText("Escuchar voz de Tomás");
  const transcript = screen.getByText("«Hola»");
  expect(audio.compareDocumentPosition(transcript) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(
    audio.compareDocumentPosition(screen.getByText("Una muestra")) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  view.rerender(
    <View sprite={{ name: "Nico", file: "nico.png", characterFile: "characters/nico.json" }} />,
  );
  expect((await screen.findByText(/Fenrir ·/)).textContent).toContain("Aprobada");
  expect(screen.getByText("Aún no hay una muestra de voz disponible.")).toBeTruthy();
  expect(screen.queryByLabelText("Escuchar voz de Tomás")).not.toBeTruthy();
});
it("indica cuando faltan el perfil o el audio", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("characters/") ? { ok: true, json: async () => character } : { ok: false },
    ),
  );
  render(<View sprite={item} />);
  expect(await screen.findByText("No se pudo cargar el perfil de voz.")).toBeTruthy();
  fireEvent.error(screen.getByLabelText("Escuchar voz de Tomás"));
  expect(screen.getByText("No se pudo cargar la muestra de voz.")).toBeTruthy();
});
it("valida rutas de fichas y muestras, y conserva la compatibilidad con sprites comunes", () => {
  expect(readSprites({ sprites: [item] })[0].voiceSample?.file).toContain("L02.wav");
  expect(
    readSprites({ sprites: [{ name: "barco", file: "barco.png" }] })[0].characterFile,
  ).toBeUndefined();
  expect(() => readSprites({ sprites: [{ ...item, characterFile: "../secreto" }] })).toThrow();
  expect(() =>
    readSprites({ sprites: [{ ...item, voiceSample: { file: "https://example.com/a.wav" } }] }),
  ).toThrow();
});
