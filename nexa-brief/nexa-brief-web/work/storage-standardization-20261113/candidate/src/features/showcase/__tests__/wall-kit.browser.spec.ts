import { expect, test } from "@playwright/test";

test("las demos del Muro muestran la biblioteca real del kit", async ({ page }) => {
  test.setTimeout(150_000);
  const session = page.waitForResponse((r) => r.url().includes("/api/auth/session"));
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await session;
  await page.getByRole("button", { name: /Entrar directo/ }).click();
  await page.waitForURL(/dashboard/);
  await page.goto("/showcase");
  await page.getByRole("button", { name: "Diseños", exact: true }).click();
  const group = page.getByRole("group", { name: "Diseños Sandbox" });
  for (const [title, prefix] of [
    ["Atlas · Neón Geopolítica · nodepolitics", "atlas."],
    ["La noche que cayó el Muro · nodehistory", "memorias."],
  ] as const) {
    await group.getByRole("button", { name: title, exact: true }).click();
    await expect(page.getByRole("tab", { name: "Prototipo", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Prototipo completo" })).toBeVisible();
    const library = page.getByRole("tab", { name: /^Biblioteca \([1-9]/ });
    await expect(library).toBeVisible({ timeout: 45_000 });
    console.log(title, await library.textContent());
    await library.click();
    const first = page.locator('section[aria-label="Componentes"] article').first();
    await expect(first).toContainText(prefix, { timeout: 45_000 });
    const positions = page.getByRole("group", { name: "Fotograma de las tarjetas" });
    await expect(
      positions.getByRole("button", { name: prefix === "atlas." ? "Final" : "Inicio" }),
    ).toHaveAttribute("aria-pressed", "true");
    await first.scrollIntoViewIfNeeded();
    const still = first.locator("iframe[title^=Fotograma]");
    await expect(still).toHaveAttribute("src", prefix === "atlas." ? /[?&]t=5.5/ : /[?&]t=0/, {
      timeout: 30000,
    });
    await positions.getByRole("button", { name: "Medio" }).click();
    await first.scrollIntoViewIfNeeded();
    await expect(still).toHaveAttribute("src", /[?&]t=3/);
    await positions.getByRole("button", { name: "Inicio" }).click();
    await first.scrollIntoViewIfNeeded();
    await expect(still).toHaveAttribute("src", /[?&]t=0/);
    await positions.getByRole("button", { name: "Final" }).click();
    await first.scrollIntoViewIfNeeded();
    await expect(still).toHaveAttribute("src", /[?&]t=5.5/);
    await first.getByRole("button", { name: /Reproducir animación/ }).click();
    await expect(first.locator("[data-animation-ready]")).toHaveAttribute(
      "data-animation-ready",
      "true",
      { timeout: 45_000 },
    );
    await first.getByRole("button", { name: /Detener animación/ }).click();
    await first.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    const search = page.getByRole("searchbox", { name: "Buscar en la biblioteca" });
    await search.fill("not-a-real-component");
    await expect(page.getByText("Nada coincide con la búsqueda.")).toBeVisible();
    await search.clear();
    await page.getByRole("tab", { name: "New componente", exact: true }).click();
    const resources = page.getByRole("region", { name: "Recursos para agentes" });
    await expect(resources).toBeVisible();
    await expect(
      resources.getByRole("heading", { name: "design.json", exact: true }),
    ).toBeVisible();
    await expect(resources.getByRole("heading", { name: "PLAN.md", exact: true })).toBeVisible();
  }
});
