import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("compact driver badge puts points right of the level and title", async ({ page }) => {
  await signUp(page);
  const badge = page.getByRole("link", { name: /Level 1, Pit Lane Rookie, 0 points/ });
  const title = badge.getByText("Pit Lane Rookie", { exact: true });
  const points = badge.getByText("0 pts", { exact: true });
  await expect(title).toBeVisible();
  await expect(points).toBeVisible();
  const [t, p, header] = await Promise.all([title.boundingBox(), points.boundingBox(), page.locator("header.sticky").boundingBox()]);
  expect(p!.x).toBeGreaterThanOrEqual(t!.x + t!.width);
  expect(header!.height).toBeLessThan(88);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(title).toBeVisible();
  await expect(points).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
