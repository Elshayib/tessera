import { expect, test } from "@playwright/test";

test("visual empty viewport", async ({ page }) => {
  await page.goto("/");
  const viewport = page.getByRole("region", { name: "Viewport" });
  await expect(viewport).toBeVisible();
  await expect(viewport).toHaveScreenshot("empty-viewport.png");
});
