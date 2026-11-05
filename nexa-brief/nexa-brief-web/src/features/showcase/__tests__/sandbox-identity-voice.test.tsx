import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SandboxJsonCard } from "../components/SandboxJsonCard";
import { readComponents } from "../lib/sandbox-catalog";

afterEach(cleanup);

it("muestra una muestra de voz con subtítulos junto a la identidad", () => {
  render(
    <SandboxJsonCard
      item={{
        name: "personajes.identidad-lia",
        kind: "json",
        family: "Personajes",
        demo: { tema: "Moda" },
      }}
      audioSrc="/assets/voz.mp3"
      captionsSrc="/assets/voz.vtt"
    />,
  );
  const player = screen.getByLabelText("Muestra de voz de personajes.identidad-lia");
  expect(player.getAttribute("src")).toBe("/assets/voz.mp3");
  const track = player.querySelector("track");
  expect(track?.getAttribute("src")).toBe("/assets/voz.vtt");
  expect(track?.getAttribute("kind")).toBe("captions");
  expect(
    screen.getByRole("region", { name: "JSON de personajes.identidad-lia" }).textContent,
  ).toContain("Moda");
});

it("rechaza rutas de audio o subtítulos fuera del catálogo", () => {
  expect(() => readComponents({ components: [{ name: "x", audio: "../privado.mp3" }] })).toThrow();
  expect(() =>
    readComponents({ components: [{ name: "x", captions: "https://otro.test/a.vtt" }] }),
  ).toThrow();
  expect(
    readComponents({
      components: [{ name: "x", audio: "assets/voz.mp3", captions: "assets/voz.vtt" }],
    }),
  ).toHaveLength(1);
});
