import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { SandboxCatalog } from "../components/SandboxCatalog";
import { SandboxSpriteModal } from "../components/SandboxCatalogModals";
import type { CatalogSprite } from "../lib/sandbox-catalog";
import { readSprites } from "../lib/sandbox-catalog";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("muestra los personajes en su pestaña y cambia la pose del modal compartido", async () => {
  const info = {
    catalog: {
      components: "components.json",
      gallery: "showcase.html",
      sprites: "characters.json",
      spritesDir: "thumbs",
      spritesLabel: "Personaje",
    },
  };
  const sprites = {
    sprites: [
      {
        name: "Nara",
        file: "talk.jpg",
        characterFile: "nara.json",
        poses: [
          { name: "talk", file: "talk.jpg" },
          { name: "think", file: "think.jpg" },
        ],
        voiceSample: {
          file: "sandbox/nodeaction/example/sample.mp3",
          captions: "sandbox/nodeaction/example/sample.vtt",
          text: "Hola",
        },
      },
      {
        name: "Nora",
        file: "nora.jpg",
        characterFile: "nora.json",
        poses: [{ name: "talk", file: "nora.jpg" }],
        voiceSample: { file: "sandbox/nodeaction/example/nora.mp3" },
      },
    ],
  };
  const identity = {
    id: "nara",
    tema: "Ciencia",
    objetivo: "Explicar",
    personalidad: ["curiosa"],
    idioma: "español",
    voz: { nombre: "Kore", modelo: "Gemini", direccion: "Cálida", aprobada: false },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith("info.json")
          ? info
          : url.endsWith("characters.json")
            ? sprites
            : url.endsWith("nara.json")
              ? identity
              : url.endsWith("nora.json")
                ? { id: "nora", tema: "Astronomía", voz: { nombre: "Kore" } }
                : { components: [] },
    })),
  );
  render(
    <SandboxCatalog path="sandbox/nodeaction/example" query="" format="9x16">
      <p>Prototipo</p>
    </SandboxCatalog>,
  );
  fireEvent.click(await screen.findByRole("tab", { name: "Personaje (2)" }));
  fireEvent.click(screen.getByRole("article", { name: "Nara" }));
  const modal = screen.getByRole("dialog", { name: "Nara" });
  expect(await within(modal).findByText("Ciencia")).toBeTruthy();
  expect(within(modal).getByText("Pendiente de aprobación", { exact: false })).toBeTruthy();
  expect(
    within(modal)
      .getByLabelText("Escuchar voz de Nara")
      .querySelector("track")
      ?.getAttribute("src"),
  ).toContain("sample.vtt");
  const gallery = within(modal).getByRole("region", { name: "Poses de Nara" });
  expect(gallery.querySelector(".overflow-y-auto")).toBeTruthy();
  fireEvent.click(within(gallery).getByRole("button", { name: "Ver pose think" }));
  expect(
    within(modal)
      .getByRole("img", { name: /Sprite ampliado/ })
      .getAttribute("src"),
  ).toContain("think.jpg");
  expect(
    within(gallery).getByRole("button", { name: "Ver pose think" }).getAttribute("aria-pressed"),
  ).toBe("true");
  expect(within(modal).queryByRole("combobox", { name: "Estado" })).toBeNull();
  const navigation = within(modal).getByRole("navigation", { name: "Personajes" });
  fireEvent.click(within(navigation).getByRole("button", { name: "Ver personaje Nora" }));
  const next = screen.getByRole("dialog", { name: "Nora" });
  expect(await within(next).findByText("Astronomía")).toBeTruthy();
  expect(within(next).getByLabelText("Escuchar voz de Nora").getAttribute("src")).toContain(
    "nora.mp3",
  );
  expect(
    within(next)
      .getByRole("img", { name: /Sprite ampliado/ })
      .getAttribute("src"),
  ).toContain("nora.jpg");
});

it("rechaza rutas inseguras en las poses", () => {
  expect(() =>
    readSprites([{ name: "Nara", file: "talk.jpg", poses: [{ name: "x", file: "../fuera.jpg" }] }]),
  ).toThrow();
});

it("mueve los personajes de la plantilla existente a la columna de navegación", async () => {
  const items: CatalogSprite[] = [
    {
      name: "Rosa",
      file: "rosa.png",
      characterFile: "rosa.json",
      voiceSample: { file: "sandbox/vida/rosa.wav" },
    },
    {
      name: "Nico",
      file: "nico.png",
      characterFile: "nico.json",
      voiceSample: { file: "sandbox/vida/nico.wav" },
    },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({ id: url.includes("rosa") ? "rosa" : "nico" }),
    })),
  );
  function Example() {
    const [item, setItem] = useState(items[0]);
    return (
      <SandboxSpriteModal
        path="sandbox/vida"
        catalog={{ components: "catalog.json", gallery: "gallery.html", spritesDir: "sprites" }}
        item={item}
        items={items}
        onSelect={setItem}
        onClose={() => {}}
      />
    );
  }
  render(<Example />);
  const rosa = screen.getByRole("dialog", { name: "Rosa" });
  expect(within(rosa).getByRole("combobox", { name: "Estado" })).toBeTruthy();
  fireEvent.click(within(rosa).getByRole("button", { name: "Ver personaje Nico" }));
  const nico = screen.getByRole("dialog", { name: "Nico" });
  expect(
    within(nico)
      .getByRole("img", { name: /Sprite ampliado/ })
      .getAttribute("src"),
  ).toContain("nico.png");
  expect(
    (await within(nico).findByLabelText("Escuchar voz de Nico")).getAttribute("src"),
  ).toContain("nico.wav");
});
