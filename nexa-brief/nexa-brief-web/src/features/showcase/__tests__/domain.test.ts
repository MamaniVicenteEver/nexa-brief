import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { createElement, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  commonItem,
  component,
  context,
  designItem,
  designs,
  unavailableItem,
  videoItem,
} from "../__fixtures__/contracts";
import { ShowcasePreviewError, type ShowcaseRepository } from "../api/showcase-repository";
import { ComponentDetails } from "../components/ComponentDetails";
import { ShowcaseGrid, type GridProps } from "../components/ShowcaseGrid";
import { ShowcaseToolbar, type ToolbarProps } from "../components/ShowcaseToolbar";
import { StagePreview } from "../components/StagePreview";
import { useLazyStage } from "../hooks/useLazyStage";
import { useShowcaseState } from "../hooks/useShowcaseState";
import { filterItems, resolveSelection } from "../lib/filters";
import { DEFAULT_FORMAT, FORMATS, getFormat, isFormatId } from "../lib/formats";
import type { Design, Item } from "../types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  TestObserver.instances = [];
});

class TestObserver implements IntersectionObserver {
  static instances: TestObserver[] = [];
  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds = [0];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = () => [];
  constructor(
    private callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.rootMargin = options?.rootMargin ?? "0px";
    TestObserver.instances.push(this);
  }
  enter(target: Element, isIntersecting = true) {
    this.callback([{ target, isIntersecting } as IntersectionObserverEntry], this);
  }
}

function fakeRepository(): ShowcaseRepository {
  return {
    getDesigns: vi.fn(async () => designs),
    getLibrary: vi.fn(async () => [videoItem, unavailableItem]),
    getCatalog: vi.fn(async () => [commonItem, designItem]),
    previewUrl: vi.fn((item) => {
      if (item.designId === null) throw new ShowcasePreviewError("Diseño desconocido");
      return `/stage-fixture.html?item=${encodeURIComponent(item.key)}`;
    }),
  };
}

describe("selección, búsqueda y orden del dominio", () => {
  it("descubre familias distintas del ID y mantiene propios antes de comunes sin mutar entradas", () => {
    const own: Item = {
      ...designItem,
      key: "nuevo",
      designId: "nuevo",
      component: { name: "otra-familia.titulo", params: {} },
    };
    const secondCommon: Item = {
      ...commonItem,
      key: "common-2",
      component: { name: "common.otro", params: {} },
    };
    const duplicate = { ...own, key: "duplicado-estable" };
    const input = [commonItem, own, secondCommon, designItem, duplicate];
    const output = filterItems(input, { kind: "design", id: "nuevo" }, designs, "");
    expect(output).toEqual([own, duplicate, commonItem, secondCommon]);
    expect(input).toEqual([commonItem, own, secondCommon, designItem, duplicate]);
    expect(output[0]).toBe(own);
    expect(filterItems(input, { kind: "design", id: "desconocido" }, designs, "")).toEqual([]);
  });

  it("busca subcadenas en nombre, resumen, tags y video, sin trim ni normalizar tildes", () => {
    const selection = { kind: "design", id: "rough" } as const;
    for (const query of ["TARJ", "DE EJEMPLO", "TEXTO", "ÁMBITO"]) {
      expect(filterItems([designItem], selection, designs, query)).toEqual([designItem]);
    }
    for (const query of ["ambito", " rough.tarjeta", "contenido"]) {
      expect(filterItems([designItem], selection, designs, query)).toEqual([]);
    }
    expect(
      filterItems([videoItem, unavailableItem], { kind: "videos" }, designs, "NODETECH/"),
    ).toEqual([videoItem]);
    expect(filterItems([videoItem], { kind: "videos" }, designs, "texto")).toEqual([]);
    expect(filterItems([unavailableItem], { kind: "videos" }, designs, "sandbox")).toEqual([
      unavailableItem,
    ]);
  });

  it("valida selección y formatos con defaults sin fijar un inventario de diseños", () => {
    expect(resolveSelection({ kind: "design", id: "viejo" }, designs)).toEqual({
      kind: "design",
      id: designs[0].id,
    });
    expect(resolveSelection({ kind: "videos" }, [])).toEqual({ kind: "videos" });
    expect(resolveSelection({ kind: "design", id: "nuevo" }, designs)).toEqual({
      kind: "design",
      id: "nuevo",
    });
    expect(resolveSelection({ kind: "design", id: "viejo" }, [])).toEqual({
      kind: "design",
      id: "",
    });
    expect(DEFAULT_FORMAT).toBe("9x16");
    expect(FORMATS.map(({ id }) => id)).toEqual(["9x16", "16x9"]);
    for (const format of FORMATS) {
      expect(isFormatId(format.id)).toBe(true);
      expect(getFormat(format.id)).toBe(format);
      expect(format.minCardWidth).toBeGreaterThan(0);
    }
    for (const invalid of [null, undefined, "", "9:16", "constructor", {}])
      expect(isFormatId(invalid)).toBe(false);
    expect(getFormat("inválido")).toBe(getFormat(DEFAULT_FORMAT));
  });
});

describe("preferencias de la grilla", () => {
  it("no accede a storage durante SSR", () => {
    const read = vi.spyOn(Storage.prototype, "getItem");
    const write = vi.spyOn(Storage.prototype, "setItem");
    function ServerProbe() {
      const state = useShowcaseState(designs);
      return createElement("p", null, `${state.selection.kind}:${state.format}`);
    }
    expect(renderToString(createElement(ServerProbe))).toContain("design:9x16");
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("restaura después del montaje y espera el índice sin sobrescribir el diseño guardado", () => {
    localStorage.setItem("kit.design", "nuevo");
    localStorage.setItem("kit.orient", "16x9");
    const hook = renderHook(({ list }: { list: Design[] }) => useShowcaseState(list), {
      initialProps: { list: [] as Design[] },
      wrapper: StrictMode,
    });
    expect(localStorage.getItem("kit.design")).toBe("nuevo");
    expect(hook.result.current.format).toBe("16x9");
    hook.rerender({ list: designs });
    expect(hook.result.current.selection).toEqual({ kind: "design", id: "nuevo" });
    act(() => hook.result.current.setQuery("Ámbito "));
    act(() => hook.result.current.setSelection({ kind: "videos" }));
    act(() => hook.result.current.setFormat("9x16"));
    expect(hook.result.current.query).toBe("Ámbito ");
    expect(hook.result.current.format).toBe("9x16");
    expect(localStorage.getItem("kit.design")).toBe("videos");
    expect(localStorage.getItem("kit.orient")).toBe("9x16");
  });

  it("descarta valores inválidos y permite seleccionar sin almacenamiento", () => {
    localStorage.setItem("kit.design", "eliminado");
    localStorage.setItem("kit.orient", "constructor");
    const hook = renderHook(() => useShowcaseState(designs));
    expect(hook.result.current.selection).toEqual({ kind: "design", id: "rough" });
    expect(hook.result.current.format).toBe("9x16");
    act(() => hook.result.current.setFormat("otro"));
    expect(hook.result.current.format).toBe("9x16");
    hook.unmount();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    const blocked = renderHook(() => useShowcaseState(designs));
    act(() => blocked.result.current.setSelection({ kind: "videos" }));
    act(() => blocked.result.current.setFormat("16x9"));
    expect(blocked.result.current.selection).toEqual({ kind: "videos" });
    expect(blocked.result.current.format).toBe("16x9");
  });
});

describe("montaje diferido y replay", () => {
  it("observa con margen 200px, conserva el montaje y limpia al cambiar URL o desmontar", () => {
    vi.stubGlobal("IntersectionObserver", TestObserver);
    const hook = renderHook(({ src }) => useLazyStage(src), { initialProps: { src: "/uno" } });
    const host = document.createElement("div");
    act(() => {
      hook.result.current.hostRef(host);
    });
    const observer = TestObserver.instances[0];
    expect(observer.rootMargin).toBe("200px");
    expect(observer.observe).toHaveBeenCalledWith(host);
    act(() => observer.enter(host, false));
    expect(hook.result.current.shouldMount).toBe(false);
    act(() => observer.enter(host));
    expect(hook.result.current.shouldMount).toBe(true);
    expect(observer.disconnect).toHaveBeenCalled();
    act(() => observer.enter(host, false));
    expect(hook.result.current.shouldMount).toBe(true);
    act(() => hook.result.current.replay());
    expect(hook.result.current.replayKey).toBe(1);
    hook.rerender({ src: "/dos" });
    expect(hook.result.current.shouldMount).toBe(false);
    expect(hook.result.current.replayKey).toBe(0);
    const next = TestObserver.instances.at(-1);
    hook.unmount();
    expect(next?.disconnect).toHaveBeenCalled();
    // Un callback ya encolado de una observación anterior queda inactivo.
    act(() => observer.enter(host));
  });

  it("replay monta antes de la intersección y fallback monta si falta IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", TestObserver);
    const hook = renderHook(() => useLazyStage("/uno"));
    act(() => hook.result.current.replay());
    expect(hook.result.current.shouldMount).toBe(true);
    expect(hook.result.current.replayKey).toBe(1);
    hook.unmount();
    vi.stubGlobal("IntersectionObserver", undefined);
    const fallback = renderHook(() => useLazyStage("/dos"));
    act(() => {
      fallback.result.current.hostRef(document.createElement("div"));
    });
    expect(fallback.result.current.shouldMount).toBe(true);
  });

  it("cambiar formato conserva el iframe; replay reemplaza solo ese iframe", () => {
    vi.stubGlobal("IntersectionObserver", TestObserver);
    const preview = render(
      createElement(StagePreview, {
        src: "/stage-fixture",
        title: "Prueba",
        format: "9x16",
        componentName: "rough.prueba",
      }),
    );
    expect(preview.container.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Repetir animación Prueba" }));
    const frame = screen.getByTitle("Prueba");
    preview.rerender(
      createElement(StagePreview, {
        src: "/stage-fixture",
        title: "Prueba",
        format: "16x9",
        componentName: "rough.prueba",
      }),
    );
    expect(screen.getByTitle("Prueba")).toBe(frame);
    expect(frame.parentElement?.style.aspectRatio).toBe("16 / 9");
    fireEvent.click(screen.getByRole("button", { name: "Repetir animación Prueba" }));
    expect(screen.getByTitle("Prueba")).not.toBe(frame);
  });

  it("informa un componente ausente y permite reintentar sin dejar temporizadores", () => {
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", undefined);
    const preview = render(
      createElement(StagePreview, {
        src: "/stage-fixture",
        title: "Prueba",
        format: "9x16",
        componentName: "rough.ausente",
      }),
    );
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByRole("alert").textContent).toContain("No se pudo cargar");
    fireEvent.click(screen.getByRole("button", { name: "Repetir animación Prueba" }));
    expect(screen.queryByRole("alert")).toBeNull();
    preview.unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

describe("vistas presentacionales con repositorio fake", () => {
  it("toolbar conserva orden y comunica selección, búsqueda, formatos y contador accesibles", () => {
    const props: ToolbarProps = {
      designs,
      selection: { kind: "design", id: "nuevo" },
      query: "",
      format: "9x16",
      count: 2,
      onSelect: vi.fn(),
      onQuery: vi.fn(),
      onFormat: vi.fn(),
    };
    render(createElement(ShowcaseToolbar, props));
    const selector = screen.getByRole("combobox", { name: "Diseño" });
    expect(selector.textContent).toBe("Nuevo · nuevo");
    HTMLElement.prototype.scrollIntoView = vi.fn();
    fireEvent.keyDown(selector, { key: "ArrowDown" });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Prototipo · rough",
      "Nuevo · nuevo",
      "Componentes de videos",
    ]);
    fireEvent.click(screen.getByRole("option", { name: "Componentes de videos" }));
    expect(props.onSelect).toHaveBeenCalledWith({ kind: "videos" });
    fireEvent.keyDown(selector, { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "Prototipo · rough" }));
    expect(props.onSelect).toHaveBeenCalledWith({ kind: "design", id: "rough" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar componentes" }), {
      target: { value: "Ámbito " },
    });
    expect(props.onQuery).toHaveBeenCalledWith("Ámbito ");
    fireEvent.click(screen.getByRole("button", { name: "16:9" }));
    expect(props.onFormat).toHaveBeenCalledWith("16x9");
    expect(screen.getByRole("status").textContent).toBe("2 componentes");
  });

  it("grilla muestra carga, error recuperable y vacío sin montar previews", () => {
    const props: GridProps = {
      items: [designItem],
      format: "9x16",
      state: "loading",
      context,
      repo: fakeRepository(),
      onRetry: vi.fn(),
      onOpen: vi.fn(),
    };
    const grid = render(createElement(ShowcaseGrid, props));
    expect(screen.getByRole("status").textContent).toContain("Cargando");
    grid.rerender(
      createElement(ShowcaseGrid, { ...props, state: "error", error: "Catálogo sin conexión" }),
    );
    expect(screen.getByRole("alert").textContent).toBe("Catálogo sin conexión");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(props.onRetry).toHaveBeenCalledOnce();
    grid.rerender(createElement(ShowcaseGrid, { ...props, state: "empty" }));
    expect(screen.getByRole("status").textContent).toContain("Nada coincide");
    expect(props.repo.previewUrl).not.toHaveBeenCalled();
  });

  it("mantiene metadata y entradas con diagnóstico; abrir no consulta datos ni recarga otros previews", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const repo = fakeRepository();
    const props: GridProps = {
      items: [designItem, commonItem, videoItem, unavailableItem],
      format: "9x16",
      state: "ready",
      context,
      repo,
      onRetry: vi.fn(),
      onOpen: vi.fn(),
    };
    const grid = render(createElement(ShowcaseGrid, props));
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(grid.container.querySelectorAll("iframe")).toHaveLength(3);
    expect(screen.getByRole("status").textContent).toContain(unavailableItem.unavailableReason);
    expect(screen.queryByText("sandbox/ejemplo")).toBeNull();
    const info = screen.getByRole("button", { name: "Mostrar información de desconocido.tarjeta" });
    fireEvent.click(info);
    expect(info.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("sandbox/ejemplo")).toBeDefined();
    fireEvent.click(info);
    expect(info.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.getByRole("button", { name: "Ampliar desconocido.tarjeta" }).hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.click(screen.getAllByRole("button", { name: "Ampliar rough.tarjeta" })[1]);
    expect(props.onOpen).toHaveBeenCalledWith(videoItem);
    expect(repo.getCatalog).not.toHaveBeenCalled();
    expect(repo.getLibrary).not.toHaveBeenCalled();
    const frames = [...grid.container.querySelectorAll("iframe")];
    grid.rerender(createElement(ShowcaseGrid, { ...props, format: "16x9" }));
    expect([...grid.container.querySelectorAll("iframe")]).toEqual(frames);
    fireEvent.click(
      screen.getByRole("button", { name: "Repetir animación Vista previa de common.text" }),
    );
    const replayed = [...grid.container.querySelectorAll("iframe")];
    expect(replayed[0]).toBe(frames[0]);
    expect(replayed[1]).not.toBe(frames[1]);
    expect(replayed[2]).toBe(frames[2]);
  });

  it("una URL inválida mantiene la tarjeta y muestra el error del repositorio", () => {
    const repo = fakeRepository();
    vi.mocked(repo.previewUrl).mockImplementation(() => {
      throw new ShowcasePreviewError("Ruta no permitida");
    });
    const grid = render(
      createElement(ShowcaseGrid, {
        items: [videoItem],
        format: "9x16",
        state: "ready",
        context,
        repo,
        onRetry: vi.fn(),
        onOpen: vi.fn(),
      }),
    );
    expect(screen.getByRole("status").textContent).toContain("Ruta no permitida");
    expect(screen.getByRole("heading", { name: "rough.tarjeta" })).toBeDefined();
    expect(grid.container.querySelector("iframe")).toBeNull();
  });

  it("details exporta las props acordadas y presenta JSON heterogéneo, límites, requeridos y ejemplo escapados", () => {
    const enriched = {
      ...component,
      params: {
        ...component.params,
        limite: { type: "number", min: 0, max: 10, default: 0 },
        activo: { type: "boolean", default: false },
        vacio: { type: "custom", default: null, doc: "<script>dato</script>" },
        cadena: { type: "string", default: "" },
      },
    };
    const details = render(
      createElement(ComponentDetails, {
        component: enriched,
        source: videoItem.source,
        mode: "card",
      }),
    );
    expect(screen.getByRole("region", { name: "Parámetros" })).toBeDefined();
    expect(screen.getByText(/· obligatorio/)).toBeDefined();
    expect(screen.getByText("Mínimo: 0")).toBeDefined();
    expect(screen.getByText("Máximo: 10")).toBeDefined();
    expect(screen.getByText(JSON.stringify(component.params.variante.options))).toBeDefined();
    expect(screen.getByText("<script>dato</script>")).toBeDefined();
    expect(details.container.querySelector("script")).toBeNull();
    const example = screen.getByLabelText("Ejemplo de rough.tarjeta");
    expect(JSON.parse(example.textContent ?? "")).toEqual({
      at: "palabras ancla",
      use: component.name,
      params: component.example,
    });
    expect(details.container.querySelector("details")?.open).toBe(false);
    details.rerender(
      createElement(ComponentDetails, {
        component: enriched,
        source: videoItem.source,
        mode: "modal",
      }),
    );
    expect(screen.getByRole("region", { name: "Parámetros" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Ejemplo para storyboard.json" })).toBeDefined();
    expect(details.container.querySelector("details")).toBeNull();
    details.rerender(
      createElement(ComponentDetails, {
        component: { name: "nuevo.vacio", params: {}, example: null },
        mode: "modal",
      }),
    );
    expect(screen.getByText("Sin parámetros.")).toBeDefined();
    expect(
      JSON.parse(screen.getByLabelText("Ejemplo de nuevo.vacio").textContent ?? "").params,
    ).toEqual({});
  });
});
