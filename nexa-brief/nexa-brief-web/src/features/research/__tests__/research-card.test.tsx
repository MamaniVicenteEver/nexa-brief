import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResearchCard } from "../components/ResearchCard";
import type { ResearchCard as ResearchCardData } from "../domain/research";

// El mock devuelve la clave tal cual: las pruebas comparan contra las claves de traducción.
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

afterEach(() => {
  cleanup();
});

const card: ResearchCardData = {
  id: "81e15c5914aca54d",
  topic: "PULSO, club de running ficticio",
  researchedAt: "2026-11-13",
  originRoot: "sandbox",
  originCategory: "nodemotion",
  originVideoId: "pulso",
  originPath: "sandbox/nodemotion/pulso/work/research",
  revision: "r1",
  versionCount: 2,
  tags: ["sandbox", "nodemotion", "running"],
  counts: { findings: 2, sources: 3, discarded: 1, images: 0, files: 4, videos: 0 },
  coverUrl: null,
};

describe("ResearchCard", () => {
  it("muestra tema, datos y cuántas versiones tiene", () => {
    render(<ResearchCard card={card} onOpen={() => {}} />);

    expect(screen.getByText("PULSO, club de running ficticio")).toBeTruthy();
    expect(screen.getByText(/versions/)).toBeTruthy();
    expect(screen.getByText("counts.findings")).toBeTruthy();
    expect(screen.getByText("counts.videos")).toBeTruthy();
  });

  it("no repite la carpeta ni el origen como etiquetas", () => {
    render(<ResearchCard card={card} onOpen={() => {}} />);

    expect(screen.getByText("running")).toBeTruthy();
    expect(screen.queryByText("sandbox")).toBeNull();
    expect(screen.queryByText("nodemotion")).toBeNull();
  });

  it("abre el detalle al pulsar Ver", () => {
    const onOpen = vi.fn();
    render(<ResearchCard card={card} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button", { name: "view" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
