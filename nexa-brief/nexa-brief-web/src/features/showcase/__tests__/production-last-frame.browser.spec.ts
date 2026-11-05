import { expect, test } from "@playwright/test";

test("producción muestra por defecto el final de cada componente", async ({ page }) => {
  test.setTimeout(150_000);
  const session = page.waitForResponse((r) => r.url().includes("/api/auth/session"));
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await session;
  await page.getByRole("button", { name: /Entrar directo/ }).click();
  await page.waitForURL(/dashboard/);
  await page.goto("/showcase");
  await page.getByRole("button", { name: "Diseños", exact: true }).click();
  const production = page.getByRole("group", { name: "Diseños de producción" });
  const labels = await production.getByRole("button").allTextContents();
  expect(labels.length).toBeGreaterThan(10);
  for (const label of labels) {
    await production.getByRole("button", { name: label, exact: true }).click();
    const selector = page.getByRole("group", { name: "Fotograma de las tarjetas" });
    await expect(selector.getByRole("button", { name: "Final" })).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 45000 },
    );
    const first = page.locator('section[aria-label="Componentes"] article').first();
    if (await first.count()) {
      await first.scrollIntoViewIfNeeded();
      await expect(first.locator('iframe[title^="Fotograma"]')).toHaveAttribute(
        "src",
        /[?&]t=(5\.5|12\.5)/,
        { timeout: 45000 },
      );
    }
  }
});
