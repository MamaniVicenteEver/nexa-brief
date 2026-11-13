import { expect, test } from "@playwright/test";

test("los motores Sandbox seleccionan fotogramas sin activar la reproducción", async ({ page }) => {
  test.setTimeout(180000);
  const session = page.waitForResponse((r) => r.url().includes("/api/auth/session"));
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await session;
  await page.getByRole("button", { name: /Entrar directo/ }).click();
  await page.waitForURL(/dashboard/);
  await page.goto("/showcase");
  await page.getByRole("button", { name: "Diseños", exact: true }).click();
  const designs = page.getByRole("group", { name: "Diseños Sandbox" });
  for (const name of [
    /^Cara a Cara.*· nodeaction$/,
    /^Vida en Escena · nodeaction$/,
    /^Atlas en Movimiento · nodehistory$/,
  ]) {
    await designs.getByRole("button", { name }).click();
    await page.getByRole("tab", { name: /^Biblioteca \(/ }).click();
    const selector = page.getByRole("group", { name: "Fotograma de las tarjetas" });
    await selector.getByRole("button", { name: "Final" }).click();
    const card = page.locator('article[aria-haspopup="dialog"]').first();
    await card.scrollIntoViewIfNeeded();
    const still = card.locator('iframe[title^="Fotograma"]');
    await expect(still).toHaveAttribute("src", /framePosition=last/, { timeout: 45000 });
    await expect(card.getByRole("button", { name: /Reproducir animación/ })).toBeVisible();
    const frame = await still.elementHandle();
    await expect
      .poll(
        async () =>
          (await frame?.contentFrame())?.evaluate(
            () =>
              document.documentElement.dataset.ready === "true" ||
              Boolean((window as Window & { __animationReady?: boolean }).__animationReady),
          ) ?? false,
        { timeout: 45000 },
      )
      .toBe(true);
  }
});
