import { expect, test } from "@playwright/test";

test("visual empty viewport", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Viewport" })).toBeVisible();
  await expect(page).toHaveScreenshot("empty-viewport.png", {
    animations: "disabled",
    caret: "hide",
    mask: [page.locator("canvas")],
  });
});
