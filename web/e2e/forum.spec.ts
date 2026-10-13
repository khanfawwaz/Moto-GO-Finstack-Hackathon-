import { expect, test } from "@playwright/test";

test("Forum is the third screen and contains attributed reviews, videos and demo updates", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: "Explore", exact: true })).toBeVisible();
  await page.keyboard.press("3");
  await expect(page).toHaveURL(/\/forum$/);
  await expect(page.getByRole("heading", { name: "Forum", exact: true })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(nav.getByRole("link").nth(2)).toHaveAttribute("href", "/forum");
  await expect(nav.getByRole("link", { name: "Loans. Hotkey 4" })).toHaveAttribute("href", "/loans");
  await expect(page.getByText("Demo community feed")).toBeVisible();
  await expect(page.getByText("Rahul just bought a Tata Punch EV", { exact: true })).toBeVisible();
  await expect(page.getByText("Anjali just drove a Mahindra BE 6", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Watch Tata Punch EV review by MotorInc on YouTube" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=yt-OHKTrkig");
  await expect(page.getByRole("link", { name: "Read Triumph Speed 400 review on Autocar India" })).toHaveAttribute("href", /autocarindia.com\/bike-reviews\//);
  await expect(page.getByRole("alert")).toHaveCount(0);
  const feed = page.getByRole("feed", { name: "Automotive community feed" });
  await expect(feed.getByRole("article")).toHaveCount(10);
  await expect(feed.locator("time")).toHaveCount(10);
  await expect(feed.locator("time").first()).toContainText("13 Oct 2026");
  await expect(feed.locator("time").first()).toContainText("IST");
  await page.getByRole("button", { name: "Videos", exact: true }).click();
  await expect(feed.getByRole("article")).toHaveCount(4);
  await page.getByRole("button", { name: "Community", exact: true }).click();
  await expect(feed.getByRole("article")).toHaveCount(2);
});

test("Forum filters and search work on a phone-sized viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/forum");
  await page.getByLabel("Forum vehicle type").selectOption("bike");
  await expect(page.getByRole("heading", { name: "Triumph Speed 400", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tata Punch EV", exact: true })).toHaveCount(0);
  await page.getByLabel("Search Forum").fill("nothing-matches-3");
  await expect(page.getByRole("main").getByRole("status")).toContainText("No reviews or videos match");
  await expect(page).toHaveURL(/\/forum$/);
  await page.getByLabel("Forum vehicle type").selectOption("");
  await page.getByLabel("Search Forum").fill("MotorInc");
  await expect(page.getByRole("heading", { name: "Tata Punch EV", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
