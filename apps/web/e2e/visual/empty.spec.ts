import { expect, test } from "@playwright/test";

test("visual empty viewport", async ({ page }) => {
  await page.goto("/");
  const viewport = page.getByRole("region", { name: "Viewport" });
  await expect(viewport).toBeVisible();
  await page.locator('canvas[aria-hidden="true"]').waitFor();
  await expect
    .poll(async () => {
      const box = await viewport.boundingBox();
      if (box === null) {
        return 0;
      }
      return Math.round(box.width) * 10_000 + Math.round(box.height);
    })
    .toBeGreaterThan(0);
  let previous = 0;
  let stableFrames = 0;
  while (stableFrames < 3) {
    const box = await viewport.boundingBox();
    const key = box === null ? 0 : Math.round(box.width) * 10_000 + Math.round(box.height);
    if (key === previous && key > 0) {
      stableFrames += 1;
    } else {
      stableFrames = 0;
      previous = key;
    }
    if (stableFrames < 3) {
      await page.waitForTimeout(50);
    }
  }
  await expect(viewport).toHaveScreenshot("empty-viewport.png", {
    animations: "disabled",
    caret: "hide",
    mask: [viewport.locator("canvas")],
  });
});
