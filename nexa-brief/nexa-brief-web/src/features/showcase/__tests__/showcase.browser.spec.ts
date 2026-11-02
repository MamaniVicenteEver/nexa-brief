import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const kit = "/api/v1/explainer/files/_tools/explainer-kit";
test.setTimeout(90_000);

async function login(page: Page) {
  const sessionReady = page.waitForResponse(
    (response) => response.url().includes("/api/auth/session"),
    { timeout: 30_000 },
  );
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await sessionReady;
  await page.getByRole("button", { name: /Entrar directo/ }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
}
async function openGallery(page: Page) {
  await login(page);
  await page.goto("/showcase");
  await expect(page.getByRole("region", { name: "Componentes", exact: true })).toBeVisible({
    timeout: 45_000,
  });
}
async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(name), animations: "disabled" });
  const output = join(homedir(), "codex/nexa-brief/out/showcase");
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: join(output, `v2-${name}`), animations: "disabled" });
}

test("catálogo y grilla coinciden con el índice anterior, búsqueda y preferencias", async ({
  page,
}) => {
  await openGallery(page);
  const names = await page
    .locator('section[aria-label="Componentes"] article h2')
    .allTextContents();
  expect(names.length).toBeGreaterThan(0);
  await expect(
    page.frameLocator('section[aria-label="Componentes"] iframe').first().locator("html"),
  ).toHaveAttribute("data-gallery-state", "ended", { timeout: 45_000 });
  const cards = page.locator('section[aria-label="Componentes"] article');
  const geometry = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    }),
  );
  expect(new Set(geometry.map(({ width, height }) => `${width}:${height}`)).size).toBe(1);
  expect(geometry.filter(({ y }) => y === geometry[0].y)).toHaveLength(4);
  await screenshot(page, "desktop-grilla.png");
  await cards
    .first()
    .getByRole("button", { name: /Mostrar información/ })
    .click();
  await expect(cards.first().getByRole("region", { name: /Información de/ })).toBeVisible();
  await expect(cards.first().getByRole("region", { name: "Parámetros" })).toBeVisible();
  expect(await cards.first().boundingBox()).toEqual(geometry[0]);
  await screenshot(page, "desktop-card-info.png");
  await cards
    .first()
    .getByRole("button", { name: /Ocultar información/ })
    .click();
  const old = await page.context().newPage();
  await old.goto(`${kit}/showcase/index.html`);
  await expect(old.locator("#grid article").first()).toBeVisible({ timeout: 45_000 });
  expect(await old.locator("#grid .name").allTextContents()).toEqual(names);
  await page.getByRole("combobox", { name: "Diseño", exact: true }).click();
  expect(await page.getByRole("option").allTextContents()).toEqual(
    await old.locator("#tabs button").allTextContents(),
  );
  await page.keyboard.press("Escape");
  await old.close();
  const search = page.getByLabel("Buscar componentes");
  await search.fill("coincidencia-imposible-xyz");
  await expect(page.getByText("Nada coincide con la búsqueda.")).toBeVisible();
  await search.fill("common.");
  await expect(page.locator('section[aria-label="Componentes"] article').first()).toBeVisible();
  await page.getByRole("combobox", { name: "Diseño", exact: true }).click();
  await page.getByRole("option", { name: "Componentes de videos" }).click();
  await expect(search).toHaveValue("common.");
  await search.fill("");
  await expect(page.locator("article").first()).toBeVisible({ timeout: 45_000 });
  await page.locator('article button[aria-expanded="false"]').first().click();
  await expect(page.getByText("Video de origen:").first()).toBeVisible();
  await page.getByRole("button", { name: "16:9", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Diseño", exact: true })).toHaveText(
    "Componentes de videos",
  );
  await expect(page.getByRole("button", { name: "16:9", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("modal: stage real, controles, formato, copia y foco", async ({ page }) => {
  await openGallery(page);
  const trigger = page.locator('article button[aria-label^="Ampliar "]').first();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  const close = dialog.getByRole("button", { name: "Cerrar" });
  await expect(close).toBeFocused();
  const frame = dialog.locator("iframe");
  await expect(dialog.getByRole("button", { name: "Pausar" })).toBeEnabled({ timeout: 45_000 });
  await dialog.getByRole("button", { name: "Pausar" }).click();
  await expect(dialog.getByRole("button", { name: "Reanudar" })).toBeVisible();
  await frame.evaluate((element) => element.setAttribute("data-test-session", "original"));
  await dialog.getByRole("button", { name: /Móvil/ }).click();
  await expect(frame).toHaveAttribute("data-test-session", "original");
  await screenshot(page, "desktop-modal-9x16.png");
  await dialog.getByRole("button", { name: /Desktop/ }).click();
  await dialog.getByRole("button", { name: "Repetir animación" }).click();
  await expect(dialog.getByRole("button", { name: "Pausar" })).toBeVisible();
  await expect(dialog.getByText("Reproducción finalizada.")).toBeVisible({ timeout: 20_000 });
  await screenshot(page, "desktop-modal-16x9.png");
  await dialog.getByRole("button", { name: "Reanudar" }).click();
  await expect(dialog.getByRole("button", { name: "Pausar" })).toBeVisible();
  await dialog.getByRole("button", { name: "Copiar ejemplo" }).click();
  await expect(dialog.getByText(/Copiado|No se pudo copiar/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("grilla y modal móviles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGallery(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(
    page.frameLocator('section[aria-label="Componentes"] iframe').first().locator("html"),
  ).toHaveAttribute("data-gallery-state", "ended", { timeout: 45_000 });
  await page.locator('section[aria-label="Componentes"] article').first().scrollIntoViewIfNeeded();
  await screenshot(page, "movil-grilla.png");
  await page.locator('article button[aria-label^="Ampliar "]').first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Pausar" })).toBeEnabled({ timeout: 45_000 });
  await dialog.getByRole("button", { name: /Móvil/ }).click();
  await screenshot(page, "movil-modal.png");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(dialog).toBeInViewport();
  await dialog.getByRole("button", { name: "Cerrar" }).click();
  await expect(dialog).toHaveCount(0);
});

test("modal rechaza mensajes ajenos y cierra desde el iframe y el fondo", async ({ page }) => {
  await openGallery(page);
  const trigger = page.locator('article button[aria-label^="Ampliar "]').first();
  await trigger.click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Pausar" })).toBeEnabled({ timeout: 45_000 });
  await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>(
      'section[aria-label="Componentes"] iframe',
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: location.origin,
        source: frame?.contentWindow,
        data: { type: "kit-stage-close" },
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://otro.example",
        source: document.querySelector<HTMLIFrameElement>('[role="dialog"] iframe')?.contentWindow,
        data: { type: "kit-stage-close" },
      }),
    );
  });
  await expect(dialog).toBeVisible();
  await dialog
    .locator("iframe")
    .contentFrame()
    .locator("body")
    .click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("grilla informa un script de video ausente y recupera con replay", async ({ page }) => {
  await openGallery(page);
  const entry = await page.evaluate(async (path) => {
    const data = await (await fetch(`${path}/component-library.json`)).json();
    return data.components.find((item: { source?: string }) => item.source) as {
      name: string;
      source: string;
    };
  }, kit);
  expect(entry).toBeTruthy();
  let blocked = true;
  await page.route(`**/api/v1/explainer/files/${entry.source}`, async (route) => {
    if (blocked) await route.fulfill({ status: 404, body: "" });
    else await route.continue();
  });
  await page.getByRole("combobox", { name: "Diseño", exact: true }).click();
  await page.getByRole("option", { name: "Componentes de videos" }).click();
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: entry.name, exact: true }) })
    .first();
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByRole("alert")).toContainText("No se pudo cargar", { timeout: 45_000 });
  blocked = false;
  await card.getByRole("button", { name: /Repetir animación/ }).click();
  await expect(card.getByRole("alert")).toHaveCount(0);
  await expect(card.locator("iframe").contentFrame().locator("html")).toHaveAttribute(
    "data-gallery-state",
    "ended",
    { timeout: 45_000 },
  );
  expect(
    await card.locator("iframe").evaluate((frame, name) => {
      const stage = (frame as HTMLIFrameElement).contentWindow as
        | (Window & { Kit?: { registry?: Map<string, unknown> } })
        | null;
      return stage?.Kit?.registry?.has(name);
    }, entry.name),
  ).toBe(true);
  await expect(card.getByRole("alert")).toHaveCount(0);
});

test("error de índice y reintento recuperable", async ({ page }) => {
  await login(page);
  let fail = true;
  await page.route(`**${kit}/designs/index.json`, async (route) => {
    if (fail) await route.fulfill({ status: 503, body: "unavailable" });
    else await route.continue();
  });
  await page.goto("/showcase");
  await expect(page.locator('main [role="alert"]')).toContainText("HTTP 503", { timeout: 45_000 });
  fail = false;
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.locator('section[aria-label="Componentes"] article').first()).toBeVisible({
    timeout: 45_000,
  });
});

test("smoke público de archivos y stages auxiliares", async ({ page, request }) => {
  const index = await request.get(`${kit}/showcase/index.html`, { timeout: 15_000 });
  expect(index.status()).toBe(200);
  const etag = index.headers().etag ?? "";
  expect(etag).toBeTruthy();
  expect(
    (
      await request.get(`${kit}/showcase/index.html`, { headers: { "If-None-Match": etag } })
    ).status(),
  ).toBe(304);
  expect((await request.get("/api/v1/explainer/files/sandbox/no-existe/archivo.js")).status()).toBe(
    401,
  );
  const protectedPage = await request.get("/en/showcase", { maxRedirects: 0 });
  expect(protectedPage.status()).toBe(307);
  await page.goto(`${kit}/showcase/stage.html?d=binary&list=1`);
  await page.waitForFunction(
    () => Array.isArray((window as unknown as { __catalog?: unknown }).__catalog),
    null,
    { timeout: 60_000 },
  );
  expect(
    await page.evaluate(() => (window as unknown as { __catalog: unknown[] }).__catalog.length),
  ).toBeGreaterThan(0);
  await page.goto(`${kit}/showcase/image-stage.html?d=binary`);
  await page.waitForFunction(
    () => Boolean((window as unknown as { ImageStage?: { ready: boolean } }).ImageStage?.ready),
    null,
    { timeout: 60_000 },
  );
  expect(
    await page.evaluate(() => {
      const stage = (window as unknown as { ImageStage: Record<string, unknown> }).ImageStage;
      return ["render", "qc", "setProgress"].every((key) => typeof stage[key] === "function");
    }),
  ).toBe(true);
});
