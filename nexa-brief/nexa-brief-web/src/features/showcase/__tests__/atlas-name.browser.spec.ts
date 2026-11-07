import { expect, test } from "@playwright/test";

test("la plantilla Atlas conserva el nombre del video y muestra su nuevo nombre", async ({ page }) => {
  const session = page.waitForResponse((r) => r.url().includes("/api/auth/session"));
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await session;
  await page.getByRole("button", { name: /Entrar directo/ }).click();
  await page.waitForURL(/dashboard/);
  await page.goto("/plantillas?cat=sandbox");
  const heading = page.getByRole("heading", { name: "Atlas · Neón Geopolítica", exact: true });
  await expect(heading).toBeVisible({ timeout: 45000 });
  await heading.click();
  await expect(page.getByRole("dialog")).toContainText("Atlas · Neón Geopolítica");
});
