import { expect, test } from "@playwright/test";

test("visual empty viewport", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Viewport" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Outliner" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Inspector" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Toolbar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Box" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Settings" })).toHaveCount(0);
  await expect(page).toHaveScreenshot("empty-viewport.png", {
    animations: "disabled",
    caret: "hide",
    mask: [page.locator("canvas")],
    maxDiffPixelRatio: 0.02,
  });
});
