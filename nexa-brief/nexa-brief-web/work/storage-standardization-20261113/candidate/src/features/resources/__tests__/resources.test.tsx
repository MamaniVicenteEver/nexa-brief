import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import resourcesMessages from "../../../../messages/es/resources.json";
import studioMessages from "../../../../messages/es/studio.json";
import { MediaSlotField } from "../../studio/components/MediaSlotField";
import { ResourcesView } from "../components/ResourcesView";

vi.mock("@/features/realtime", () => ({ useRealtimeEvent: () => {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const patches: { kind: string; body: Record<string, unknown> }[] = [];
let rows: Record<string, Record<string, unknown>[]>;

function setupApi() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost");
      const parts = url.pathname.split("/");
      if (url.pathname.endsWith("/categories")) return Response.json(["Favoritos", "Paisajes"]);
      const kind = parts.includes("page") ? (parts.at(-1) ?? "") : parts[4];
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        patches.push({ kind, body });
        const row = rows[kind].find((r) => r.asset_id === parts.at(-1));
        if (!row) throw new Error("Missing test resource");
        Object.assign(row, body, { tag_list: body.tags });
        return Response.json(row);
      }
      let selected = rows[kind] ?? [];
      if (url.searchParams.get("category"))
        selected = selected.filter((r) => r.category === url.searchParams.get("category"));
      if (url.searchParams.get("q"))
        selected = selected.filter((r) =>
          JSON.stringify(r).includes(url.searchParams.get("q") ?? ""),
        );
      const page = Number(url.searchParams.get("page") ?? 1);
      return Response.json({
        items: selected.slice((page - 1) * 12, page * 12),
        total: selected.length,
        page,
        page_size: 12,
      });
    }),
  );
}

function mount(component = <ResourcesView />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="es" messages={{ ...resourcesMessages, ...studioMessages }}>
        {component}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

beforeEach(() => {
  patches.length = 0;
  window.history.replaceState(null, "", "/recursos?kind=images");
  rows = Object.fromEntries(
    ["images", "music", "videos", "sounds"].map((kind) => [
      kind,
      Array.from({ length: 25 }, (_, i) => ({
        asset_id: `${kind}-${i}`,
        label: `Recurso ${i}`,
        track_name: `Recurso ${i}`,
        title: `Recurso ${i}`,
        category: i % 2 ? "Paisajes" : "Favoritos",
        description: "Descripción inicial",
        tags: "",
        original_filename: `archivo-${i}.jpg`,
        recommended_uses: [],
      })),
    ]),
  );
  setupApi();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("muestra 12 por página, cambia de página y reinicia al filtrar, con la tarjeta de subida primero", async () => {
  const { container } = mount();
  await screen.findByRole("heading", { name: "Recurso 0" });
  expect(container.querySelectorAll("article")).toHaveLength(12);
  const upload = screen.getByRole("button", { name: "Subí imágenes" });
  expect(
    upload.closest("section")?.querySelector(".grid")?.firstElementChild?.contains(upload),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Siguientes 12" }));
  await screen.findByRole("heading", { name: "Recurso 12" });
  expect(screen.queryByRole("heading", { name: "Recurso 0" })).toBeNull();
  expect(container.querySelectorAll("article")).toHaveLength(12);
  fireEvent.click(screen.getByRole("button", { name: "Siguientes 12" }));
  await screen.findByRole("heading", { name: "Recurso 24" });
  expect(container.querySelectorAll("article")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Siguientes 12" }).hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByRole("combobox", { name: "Categoría" }), {
    target: { value: "Favoritos" },
  });
  await screen.findByRole("heading", { name: "Recurso 0" });
  expect(screen.getByText("1–12 de 13")).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Recurso 24" } });
  await waitFor(() => expect(container.querySelectorAll("article")).toHaveLength(1));
  expect(screen.getByText("1–1 de 1")).toBeTruthy();
});

it.each(["images", "music", "videos", "sounds"])(
  "edita nombre y ficha, guarda y refresca %s",
  async (kind) => {
    window.history.replaceState(null, "", `/recursos?kind=${kind}`);
    mount();
    const heading = await screen.findByRole("heading", { name: "Recurso 0" });
    const article = heading.closest("article");
    if (!article) throw new Error("Missing card");
    fireEvent.click(within(article).getByRole("button", { name: "Editar" }));
    const dialog = screen.getByRole("dialog", { name: "Editar recurso" });
    fireEvent.change(
      within(dialog).getByLabelText(kind === "music" ? "Nombre de la canción" : "Nombre"),
      { target: { value: "Nombre editado" } },
    );
    fireEvent.change(within(dialog).getByLabelText("Descripción"), {
      target: { value: "Descripción nueva" },
    });
    fireEvent.change(within(dialog).getByLabelText("Etiquetas", { exact: false }), {
      target: { value: "nuevo, favorito" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await screen.findByRole("heading", { name: "Nombre editado" });
    expect(patches).toHaveLength(1);
    expect(patches[0].kind).toBe(kind);
    expect(
      patches[0].body[kind === "music" ? "track_name" : kind === "sounds" ? "title" : "label"],
    ).toBe("Nombre editado");
    expect(patches[0].body.tags).toEqual(["nuevo", "favorito"]);
  },
);

it("no pide la librería hasta abrir recursos y desmonta el selector al cerrarlo", async () => {
  const { container } = mount(
    <MediaSlotField
      slot={{ slot: "background", kind: "image", label: "Fondo", min: 0, max: 1 } as never}
      value={[]}
      onChange={vi.fn()}
    />,
  );
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Abrir recursos" }));
  await screen.findByText("Recurso 0");
  expect(fetch).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar recursos" }));
  expect(container.querySelector("img")).toBeNull();
  expect(screen.queryByRole("searchbox")).toBeNull();
});

it.each([
  ["images", "Subí imágenes", "foto.png", "image/png"],
  ["music", "Subí canciones", "cancion.mp3", "audio/mpeg"],
  ["videos", "Subí videos", "clip.mp4", "video/mp4"],
  ["sounds", "Subí efectos de sonido", "efecto.wav", "audio/wav"],
])("sube %s por selección y arrastre y conserva la categoría", async (kind, title, name, type) => {
  window.history.replaceState(null, "", `/recursos?kind=${kind}`);
  const uploads: { url: string; body: FormData }[] = [];
  vi.stubGlobal(
    "XMLHttpRequest",
    class {
      upload = { onprogress: null };
      status = 201;
      responseText = "";
      onload?: () => void;
      url = "";
      open(_method: string, url: string) {
        this.url = url;
      }
      send(body: FormData) {
        uploads.push({ url: this.url, body });
        const row = {
          ...rows[kind][0],
          asset_id: `new-${uploads.length}`,
          label: `Nuevo ${uploads.length}`,
          track_name: `Nuevo ${uploads.length}`,
          title: `Nuevo ${uploads.length}`,
        };
        rows[kind].unshift(row);
        this.responseText = JSON.stringify(row);
        this.onload?.();
      }
    },
  );
  const { container } = mount();
  await screen.findByRole("heading", { name: "Recurso 0" });
  fireEvent.change(screen.getByRole("combobox", { name: "Categoría" }), {
    target: { value: "Favoritos" },
  });
  await screen.findByText("1–12 de 13");
  const button = screen.getByRole("button", { name: title });
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Missing file input");
  const clicked = vi.spyOn(input, "click");
  fireEvent.click(button);
  expect(clicked).toHaveBeenCalledOnce();
  fireEvent.change(input, { target: { files: [new File(["test"], name, { type })] } });
  await waitFor(() => expect(uploads).toHaveLength(1));
  await screen.findByText("Subido");
  await screen.findByRole("heading", { name: "Nuevo 1" });
  expect(uploads[0].url).toContain(`/library/${kind}`);
  expect(uploads[0].body.get("category")).toBe("Favoritos");
  expect((uploads[0].body.get("file") as File).name).toBe(name);
  const dataTransfer = {
    files: [new File(["drop"], `drop-${name}`, { type })],
    dropEffect: "none",
  };
  fireEvent.dragOver(button, { dataTransfer });
  expect(dataTransfer.dropEffect).toBe("copy");
  fireEvent.drop(button, { dataTransfer });
  await screen.findByRole("heading", { name: "Nuevo 2" });
  expect(uploads).toHaveLength(2);
  expect((uploads[1].body.get("file") as File).name).toBe(`drop-${name}`);
});

it("mantiene la subida disponible sin resultados y rechaza archivos de otro tipo", async () => {
  rows.images = [];
  const xhr = vi.fn();
  vi.stubGlobal("XMLHttpRequest", xhr);
  mount();
  await screen.findByText("Todavía no subiste imágenes");
  fireEvent.drop(screen.getByRole("button", { name: "Subí imágenes" }), {
    dataTransfer: { files: [new File(["text"], "documento.txt", { type: "text/plain" })] },
  });
  await screen.findByText("Este tipo de archivo no corresponde a la pestaña seleccionada.");
  expect(xhr).not.toHaveBeenCalled();
});
