import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { ShowcaseEntry } from "../api/standard-showcase-repository";
import { StandardCharacterDetails } from "../components/StandardCharacterDetails";

const entry: ShowcaseEntry = {
  id: "alma",
  name: "Alma",
  label: "Alma",
  kind: "character",
  summary: "",
  tags: [],
  params: {},
  example: {},
  preview_url: null,
  preview_kind: "image",
  data: {
    character: {
      identity: {
        nombre: "Alma",
        tema: "Noticias internacionales",
        personalidad: ["clara", "cálida"],
        voz: { nombre: "Sulafat", modelo: "tts", aprobada: true },
      },
      voiceSample: {
        url: "/api/v1/explainer/files/bundled/sample.mp3",
        text: "La noticia empieza aquí.",
        source: "Audición de timbre",
      },
      poses: [{ name: "talk", url: "/api/v1/explainer/files/bundled/talk.jpg" }],
    },
  },
};
afterEach(cleanup);
it("muestra voz elegida con reproducción bajo demanda, texto, personalidad y poses", () => {
  render(<StandardCharacterDetails entry={entry} />);
  const audio = screen.getByLabelText("Escuchar voz de Alma");
  expect(audio.getAttribute("preload")).toBe("none");
  expect(audio.hasAttribute("autoplay")).toBe(false);
  expect(screen.getByText("Timbre seleccionado")).toBeTruthy();
  expect(screen.getByText("«La noticia empieza aquí.»")).toBeTruthy();
  expect(screen.getByText("clara · cálida")).toBeTruthy();
  expect(screen.getByAltText("Alma: talk").getAttribute("loading")).toBe("lazy");
  fireEvent.error(audio);
  expect(screen.getByText("No se pudo cargar la muestra de voz.")).toBeTruthy();
});
it("rechaza audio y poses externos y omite datos de otros componentes", () => {
  const view = render(
    <StandardCharacterDetails
      entry={{
        ...entry,
        data: {
          character: {
            identity: { nombre: "Alma" },
            voiceSample: { url: "https://example.com/a.mp3" },
            poses: [{ name: "bad", url: "https://example.com/a.jpg" }],
          },
        },
      }}
    />,
  );
  expect(screen.queryByLabelText("Escuchar voz de Alma")).toBeNull();
  expect(screen.queryByAltText("Alma: bad")).toBeNull();
  view.rerender(<StandardCharacterDetails entry={{ ...entry, data: {} }} />);
  expect(screen.queryByLabelText("Identidad de Alma")).toBeNull();
});
