import { expect, test } from "@playwright/test";

test("smoke loads editor", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Viewport" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
