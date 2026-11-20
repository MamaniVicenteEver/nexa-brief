import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LibraryAsset } from "@/features/library/api/library-assets-service";
import { MusicEnrichButton } from "../components/MusicEnrichButton";

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));

// El mock devuelve la clave tal cual: las pruebas buscan los botones por su clave de traducción.
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../hooks/useResources", () => ({
  useEnrichMusic: () => ({ mutate, isPending: false }),
}));

function song(overrides: Partial<LibraryAsset> = {}): LibraryAsset {
  return {
    assetId: "a1",
    kind: "music",
    category: "uploads",
    title: "Tema",
    fileUrl: "/audio.mp3",
    name: "Tema",
    originalFilename: "tema.mp3",
    description: "",
    tags: [],
    artist: "",
    genre: "",
    source: "upload",
    ...overrides,
  } as unknown as LibraryAsset;
}

afterEach(() => {
  cleanup();
  mutate.mockClear();
});

describe("MusicEnrichButton", () => {
  it("pide confirmación antes de regenerar y no envía nada hasta confirmar", () => {
    render(
      <MusicEnrichButton
        asset={song({ artist: "Zeta", genre: "pop", description: "Escrita a mano", tags: ["mía"] })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "regenerate" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(mutate).not.toHaveBeenCalled();
  });

  it("al confirmar regenera solo ese recurso, con overwrite", () => {
    render(
      <MusicEnrichButton
        asset={song({ artist: "Zeta", genre: "pop", description: "Escrita a mano", tags: ["mía"] })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "regenerate" }));
    fireEvent.click(screen.getByRole("button", { name: "regenerateConfirm" }));

    expect(mutate).toHaveBeenCalledWith({ assetId: "a1", overwrite: true }, expect.any(Object));
  });

  it("con datos faltantes completa sin sobrescribir", () => {
    render(<MusicEnrichButton asset={song()} />);

    fireEvent.click(screen.getByRole("button", { name: "action" }));

    expect(mutate).toHaveBeenCalledWith({ assetId: "a1", overwrite: false }, expect.any(Object));
  });

  it("con la ficha completa muestra el estado y sigue ofreciendo regenerar", () => {
    render(
      <MusicEnrichButton
        asset={song({ artist: "K/DA", description: "Sencillo.", tags: ["pop"] })}
      />,
    );

    expect(screen.getByText("complete")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "action" })).toBeNull();
    expect(screen.getByRole("button", { name: "regenerate" })).toBeTruthy();
  });

  it("no aparece en recursos de producción", () => {
    const { container } = render(<MusicEnrichButton asset={song({ source: "production" })} />);

    expect(container.innerHTML).toBe("");
  });
});
