import { expect, test } from "@playwright/test";

test("las pestañas muestran componentes, recursos y la demo asociada", async ({ page }) => {
  test.setTimeout(90_000);
  const session = page.waitForResponse((response) => response.url().includes("/api/auth/session"), {
    timeout: 30_000,
  });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await session;
  await page.getByRole("button", { name: /Entrar directo/ }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
  await page.goto("/showcase");
  await expect(page.getByRole("tab", { name: /Biblioteca \(/ })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("searchbox", { name: "Buscar en la biblioteca" })).toBeVisible();
  const first = page.locator('section[aria-label="Componentes"] article').first();
  await expect(first).toBeVisible();
  const play = first.getByRole("button", { name: /Reproducir animación/ });
  await expect(play).toBeVisible();
  await play.click();
  await expect(first.getByRole("button", { name: /Detener animación/ })).toBeVisible();
  await expect(first.locator("[data-animation-ready]")).toHaveAttribute(
    "data-animation-ready",
    "true",
    { timeout: 45_000 },
  );
  await first.getByRole("button", { name: /Detener animación/ }).click();
  await expect(play).toBeVisible();
  await page.getByRole("tab", { name: "New componente" }).click();
  const resource = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "design.json", exact: true }) });
  await expect(resource).toBeVisible();
  await resource.getByRole("button", { name: "Ver archivo" }).click();
  await expect(resource.locator("pre code")).toContainText('"id"');
  await page.getByRole("tab", { name: "Prototipo", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    /Video de referencia|no tiene un video de referencia/i,
    { timeout: 45_000 },
  );
});

test("cada diseño de producción ofrece una biblioteca y sus documentos", async ({ page }) => {
  test.setTimeout(240_000);
  const session = page.waitForResponse((response) => response.url().includes("/api/auth/session"), {
    timeout: 30_000,
  });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await session;
  await page.getByRole("button", { name: /Entrar directo/ }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
  await page.goto("/showcase");
  const toggle = page.getByRole("button", { name: "Diseños", exact: true });
  await toggle.click();
  const group = page.getByRole("group", { name: "Diseños de producción" });
  const buttons = group.getByRole("button");
  await expect.poll(() => buttons.count(), { timeout: 45_000 }).toBeGreaterThan(1);
  const labels = (await buttons.allTextContents()).filter(
    (label) => label !== "Componentes de videos",
  );
  expect(labels.length).toBeGreaterThan(0);
  for (const label of labels) {
    await group.getByRole("button", { name: label, exact: true }).click();
    await expect(group.getByRole("button", { name: label, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("tab", { name: /Biblioteca \(/ })).toBeVisible({ timeout: 45_000 });
    const card = page.locator('section[aria-label="Componentes"] article').first();
    await expect(card).toBeVisible({ timeout: 45_000 });
    await card.getByRole("button", { name: /Reproducir animación/ }).click();
    await expect(card.locator("[data-animation-ready]")).toHaveAttribute(
      "data-animation-ready",
      "true",
      { timeout: 45_000 },
    );
    await card.getByRole("button", { name: /Detener animación/ }).click();
    await page.getByRole("tab", { name: "New componente" }).click();
    const resource = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "design.json", exact: true }) });
    await expect(resource).toBeVisible();
  }
});

test("las tarjetas respetan el formato y abren el modal sin interferir con reproducir", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const session = page.waitForResponse((response) => response.url().includes("/api/auth/session"), {
    timeout: 30_000,
  });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await session;
  await page.getByRole("button", { name: /Entrar directo/ }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
  await page.goto("/showcase");
  const card = page.locator('section[aria-label="Componentes"] article[tabindex="0"]').first();
  await expect(card).toBeVisible({ timeout: 45_000 });
  const frame = card.locator("[data-preview-frame]");
  const preview = card.locator("[data-animation-active]");
  for (const [button, ratio] of [
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
  ] as const) {
    await page.getByRole("button", { name: button, exact: true }).click();
    const outer = await frame.boundingBox();
    const inner = await preview.boundingBox();
    if (!outer || !inner) throw new Error("No se pudo medir la vista previa");
    expect(outer.width / outer.height).toBeCloseTo(ratio, 2);
    expect(Math.abs(outer.height - inner.height)).toBeLessThan(1);
    expect(Math.abs(outer.width - inner.width)).toBeLessThan(1);
    if (button === "16:9") await page.screenshot({ path: "/tmp/nexa-showcase-card-16x9.png" });
  }
  const play = card.getByRole("button", { name: /Reproducir animación/ });
  const control = await play.boundingBox();
  expect(control?.width).toBe(36);
  await play.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await card.getByRole("button", { name: /Detener animación/ }).click();
  await card.locator("h2").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cerrar" }).click();
  await expect(card).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const mobile = await frame.boundingBox();
  if (!mobile) throw new Error("No se pudo medir la vista móvil");
  expect(mobile.width / mobile.height).toBeCloseTo(9 / 16, 2);
});

test("el modal de producción ajusta su ancho al video y al panel lateral", async ({ page }) => {
  test.setTimeout(90_000);
  const session = page.waitForResponse((response) => response.url().includes("/api/auth/session"), {
    timeout: 30_000,
  });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await session;
  await page.getByRole("button", { name: /Entrar directo/ }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/showcase");
  await page.getByRole("button", { name: "Diseños", exact: true }).click();
  await page
    .getByRole("group", { name: "Diseños de producción" })
    .getByRole("button", { name: /imperio/ })
    .click();
  const card = page.locator('section[aria-label="Componentes"] article[tabindex="0"]').first();
  await expect(card).toBeVisible({ timeout: 45_000 });
  await card.locator("h2").click();
  const dialog = page.getByRole("dialog");
  const stage = dialog.getByRole("region", { name: "Vista previa del componente" });
  const frame = stage.locator("[data-preview-frame]");
  const aside = dialog.getByRole("complementary", { name: "Información del componente" });
  await expect(aside).toBeVisible();
  await dialog.getByRole("button", { name: "Desktop (16:9)" }).click();
  await expect
    .poll(async () => {
      const outer = await stage.boundingBox();
      const inner = await frame.boundingBox();
      if (!outer || !inner) return 999;
      return Math.abs(outer.width - inner.width);
    })
    .toBeLessThan(2);
  const desktopFrame = await frame.boundingBox();
  const desktopDialog = await dialog.boundingBox();
  if (!desktopFrame || !desktopDialog) throw new Error("No se pudo medir el diálogo");
  expect(desktopFrame.width / desktopFrame.height).toBeCloseTo(16 / 9, 2);
  await page.screenshot({ path: "/tmp/nexa-showcase-modal-16x9.png" });
  await dialog.getByRole("button", { name: "Móvil (9:16)" }).click();
  await expect
    .poll(async () => {
      const box = await frame.boundingBox();
      return box ? box.width / box.height : 0;
    })
    .toBeCloseTo(9 / 16, 2);
  const mobileFrame = await frame.boundingBox();
  const mobileStage = await stage.boundingBox();
  const mobileDialog = await dialog.boundingBox();
  if (!mobileFrame || !mobileStage || !mobileDialog)
    throw new Error("No se pudo medir la vista móvil");
  expect(Math.abs(mobileDialog.width - desktopDialog.width)).toBeLessThan(2);
  expect(
    Math.abs(mobileFrame.x + mobileFrame.width / 2 - (mobileStage.x + mobileStage.width / 2)),
  ).toBeLessThan(2);
  await dialog.getByRole("button", { name: "Desktop (16:9)" }).click();
  const withSidebar = await dialog.boundingBox();
  await dialog.getByRole("button", { name: "Información del componente" }).click();
  await expect(aside).toBeHidden();
  await expect
    .poll(async () => {
      const outer = await stage.boundingBox();
      const inner = await frame.boundingBox();
      if (!outer || !inner) return 999;
      return Math.abs(outer.width - inner.width);
    })
    .toBeLessThan(2);
  const withoutSidebar = await dialog.boundingBox();
  if (!withSidebar || !withoutSidebar) throw new Error("No se pudo medir el diálogo");
  expect(withoutSidebar.width).toBeLessThan(withSidebar.width - 200);
});

test("el modal Sandbox conserva el ancho de Desktop al mostrar Móvil", async ({ page }) => {
  test.setTimeout(90_000);
  const session = page.waitForResponse((response) => response.url().includes("/api/auth/session"), {
    timeout: 30_000,
  });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await session;
  await page.getByRole("button", { name: /Entrar directo/ }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/showcase");
  await page.getByRole("button", { name: "16:9", exact: true }).click();
  await page.getByRole("button", { name: "Diseños", exact: true }).click();
  const sandbox = page.getByRole("group", { name: "Diseños Sandbox" });
  await sandbox
    .getByRole("button", { name: /^Vida en Escena · nodeaction$/ })
    .click({ timeout: 45_000 });
  await page.getByRole("tab", { name: /Biblioteca \(/ }).click({ timeout: 45_000 });
  const card = page.locator('article[aria-haspopup="dialog"]').first();
  await expect(card).toBeVisible({ timeout: 45_000 });
  const play = card.getByRole("button", { name: /Reproducir animación/ });
  await expect(play).toBeVisible();
  const playBox = await play.boundingBox();
  expect(playBox?.width).toBe(36);
  await card.click({ position: { x: 10, y: 10 } });
  const dialog = page.getByRole("dialog");
  const stage = dialog.getByRole("region", { name: "Reproductor del componente" });
  const preview = stage.locator("[data-animation-active]");
  await expect(
    dialog.getByRole("complementary", { name: "Información del componente" }),
  ).toBeVisible();
  const desktopDialog = await dialog.boundingBox();
  const desktopStage = await stage.boundingBox();
  const desktopPreview = await preview.boundingBox();
  if (!desktopDialog || !desktopStage || !desktopPreview)
    throw new Error("No se pudo medir el modal Sandbox");
  expect(desktopPreview.width / desktopPreview.height).toBeCloseTo(16 / 9, 2);
  expect(Math.abs(desktopStage.width - desktopPreview.width)).toBeLessThan(2);
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "9:16", exact: true }).click();
  await card.click({ position: { x: 10, y: 10 } });
  const mobileDialog = await dialog.boundingBox();
  const mobilePreview = await preview.boundingBox();
  if (!mobileDialog || !mobilePreview) throw new Error("No se pudo medir el formato móvil");
  expect(Math.abs(mobileDialog.width - desktopDialog.width)).toBeLessThan(2);
  expect(mobilePreview.width / mobilePreview.height).toBeCloseTo(9 / 16, 2);
});

test("los cuatro diseños Sandbox usan las tarjetas y el modal de producción", async ({ page }) => {
  test.setTimeout(180_000);
  const session = page.waitForResponse((response) => response.url().includes("/api/auth/session"), {
    timeout: 30_000,
  });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await session;
  await page.getByRole("button", { name: /Entrar directo/ }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/showcase");
  await page.getByRole("button", { name: "16:9", exact: true }).click();
  await page.getByRole("button", { name: "Diseños", exact: true }).click();
  const sandbox = page.getByRole("group", { name: "Diseños Sandbox" });
  for (const name of [
    /^Cara a Cara.*· nodeaction$/,
    /^Vida en Escena · nodeaction$/,
    /^Atlas Cinemático.*· nodehistory$/,
    /^Atlas en Movimiento · nodehistory$/,
  ]) {
    await sandbox.getByRole("button", { name }).click({ timeout: 45_000 });
    await page.getByRole("tab", { name: /^Biblioteca \(/ }).click({ timeout: 45_000 });
    const card = page
      .locator('article[aria-haspopup="dialog"]')
      .filter({ has: page.locator("[data-preview-frame]") })
      .first();
    await expect(card).toBeVisible({ timeout: 45_000 });
    const frame = card.locator("[data-preview-frame]");
    const box = await frame.boundingBox();
    if (!box) throw new Error("No se pudo medir la tarjeta de Sandbox");
    expect(box.width / box.height).toBeCloseTo(16 / 9, 2);
    await card.locator("h2").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Desktop (16:9)" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Móvil (9:16)" })).toBeVisible();
    await expect(
      dialog.getByRole("complementary", { name: "Información del componente" }),
    ).toBeVisible();
    const stage = dialog.locator("[data-preview-frame]");
    await expect(stage).toBeVisible();
    const animation = stage.locator("[data-animation-active]");
    if ((await animation.count()) && name.source.includes("Cinemático")) {
      await expect(dialog.getByRole("button", { name: "Reproducir", exact: true })).toBeVisible();
    } else if (await animation.count()) {
      await expect(animation).toHaveAttribute("data-animation-ready", "true", { timeout: 45_000 });
      await dialog.getByRole("button", { name: "Detener", exact: true }).click();
      await expect(dialog.getByRole("button", { name: "Reproducir", exact: true })).toBeVisible();
      await dialog.getByRole("button", { name: "Reproducir", exact: true }).click();
      await expect(animation).toHaveAttribute("data-animation-ready", "true", { timeout: 45_000 });
    }
    const desktop = await dialog.boundingBox();
    await dialog.getByRole("button", { name: "Móvil (9:16)" }).click();
    await expect
      .poll(async () => {
        const rect = await stage.boundingBox();
        return rect ? rect.width / rect.height : 0;
      })
      .toBeCloseTo(9 / 16, 2);
    const mobile = await dialog.boundingBox();
    if (!desktop || !mobile) throw new Error("No se pudo medir el modal");
    expect(Math.abs(desktop.width - mobile.width)).toBeLessThan(2);
    await dialog.getByRole("button", { name: "Información del componente" }).click();
    await expect(
      dialog.getByRole("complementary", { name: "Información del componente" }),
    ).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  }
});
