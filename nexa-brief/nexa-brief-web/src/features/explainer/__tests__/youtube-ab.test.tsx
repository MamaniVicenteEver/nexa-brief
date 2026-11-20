import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";
import messages from "../../../../messages/es.json";
import { YouTubeABPreparation } from "../components/YouTubeABPreparation";
import type { PublishPackage, VideoThumbnails } from "../types";

const pkg = {
  titles: {
    youtube: [
      { option: "A", text: "El error que cambió una misión" },
      { option: "B", text: "Cómo sobrevivió la misión" },
      { option: "C", text: "La decisión que salvó el viaje" },
    ],
  },
} as PublishPackage;
const thumbnails = {
  chosen: "A",
  options: [
    { option: "A", url: "/thumbnail-A.jpg" },
    { option: "B", url: "/thumbnail-B.jpg" },
  ],
} as VideoThumbnails;
function show(value = pkg) {
  return render(
    <NextIntlClientProvider locale="es" messages={messages}>
      <YouTubeABPreparation pkg={value} thumbnails={thumbnails} />
    </NextIntlClientProvider>,
  );
}
afterEach(cleanup);
it("prepara títulos sin iniciar experimentos ni cambiar el contenido publicado", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  show();
  fireEvent.click(screen.getByRole("button", { name: "Copiar títulos A/B/C" }));
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      pkg.titles.youtube.map((v) => `${v.option}: ${v.text}`).join("\n\n"),
    ),
  );
  expect(
    screen.getByRole("link", { name: "Establecer prueba en Studio" }).getAttribute("href"),
  ).toBe("https://studio.youtube.com/");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "thumbnail" } });
  expect(screen.queryByText(pkg.titles.youtube[0].text, { exact: false })).toBeNull();
  expect(screen.getAllByRole("link").length).toBe(3);
});
it("no permite copiar títulos repetidos como variantes distintas", () => {
  show({
    titles: { youtube: [pkg.titles.youtube[0], { ...pkg.titles.youtube[0], option: "B" }] },
  } as PublishPackage);
  expect(
    screen.getByRole("button", { name: "Copiar títulos A/B/C" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen.getByText("Prepara dos o tres títulos distintos, de hasta 100 caracteres cada uno."),
  ).toBeTruthy();
});
