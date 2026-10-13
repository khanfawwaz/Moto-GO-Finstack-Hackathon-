import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("progress celebrates completed experiences without counters or unowned milestones", async ({ page }) => {
  await page.route("**/api/v1/collection", async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.models = body.models.map((m: { id: string; badges: string[] }) => ({ ...m, badges: m.id === "mg-comet-ev" ? ["test_driven"] : [] }));
    await route.fulfill({ response, json: body });
  });
  await page.goto("/explore");
  const progress = page.getByRole("list", { name: "Completed vehicle experiences" });
  await expect(progress).toHaveCount(1);
  await expect(progress).toHaveText("Driven");
  await expect(page.getByText(/\d\/3 milestones|Journey complete|Not completed/)).toHaveCount(0);
});

test("vehicle panel has Back and bottom-right save, with financing above", async ({ page }) => {
  await page.goto("/explore?model=mg-comet-ev");
  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("heading", { name: "MG Comet EV" })).toBeVisible();
  const finance = panel.getByRole("button", { name: /Explore financing/ });
  const back = panel.getByRole("button", { name: "Back", exact: true });
  const save = panel.getByRole("button", { name: "Save to Dream Garage" });
  await expect(finance).toContainText(/₹[\d,]+ per month\*/);
  const [f, b, s] = await Promise.all([finance.boundingBox(), back.boundingBox(), save.boundingBox()]);
  expect(f!.y).toBeLessThan(s!.y);
  expect(b!.x).toBeLessThan(s!.x);
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await back.click();
  await expect(panel).not.toBeVisible();
  await expect(page).toHaveURL(/\/explore$/);
});

test("unseen bikes and cars use the same grey treatment", async ({ page }) => {
  await page.goto("/explore");
  for (const label of ["MG Comet EV", "Hero Splendor+"]) {
    const card = page.getByRole("button", { name: `Explore ${label}`, exact: true });
    await expect(card.locator("span").first()).toHaveCSS("filter", "grayscale(1) saturate(0) brightness(0.75)");
    await expect(card.getByText("Not seen")).toBeVisible();
  }
});

test("catalogue EMI opens eligibility choices, calculator carries the plan and reuses it", async ({ page }) => {
  await signUp(page);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto("/explore");
    const own = page.getByRole("button", { name: /^Explore financing for MG Comet EV\./ });
    await expect(own).toContainText("Est. EMI ₹XX,XXX per month*");
    await own.click();
    await expect(page).toHaveURL(/\/explore\?eligibility=mg-comet-ev#eligibility$/);
    const eligibility = page.getByRole("region", { name: "Loan eligibility" });
    await expect(eligibility).toContainText("MG Comet EV");
    await eligibility.getByRole("link", { name: "Loan calculator", exact: true }).click();
    await expect(page).toHaveURL(/\/loans\?model=mg-comet-ev#emi-calculator$/);
    await expect(page.getByText("Selected: MG Comet EV")).toBeVisible();
    const calculator = page.getByRole("region", { name: "EMI calculator", exact: true });
    const inputs = page.getByRole("region", { name: "Choose a vehicle to save this plan" });
    const loans = page.getByRole("region", { name: "Loans & insurance" });
    const [left, right, above] = await Promise.all([calculator.boundingBox(), inputs.boundingBox(), loans.boundingBox()]);
    await expect(page.locator("#emi-calculator.card")).toHaveCount(1);
    await expect(calculator.getByLabel("Vehicle price (₹)")).toBeVisible();
    await expect(calculator.getByLabel("Cash down payment (₹)")).toBeVisible();
    await expect(calculator.getByLabel("Annual interest (%)")).toBeVisible();
    await expect(calculator.getByLabel("Tenure", { exact: true })).toBeVisible();
    await expect(inputs.getByRole("heading", { name: "Include current vehicle" })).toBeVisible();
    expect(right!.x).toBeGreaterThan(left!.x);
    expect(left!.y).toBeGreaterThanOrEqual(above!.y + above!.height);
    await page.getByLabel("Vehicle price (₹)").fill("900000");
    await page.getByLabel("Cash down payment (₹)").fill("200000");
    await page.getByLabel("Annual interest (%)").fill("9.5");
    await page.getByLabel("Tenure", { exact: true }).selectOption("48");
    await calculator.getByRole("button", { name: "Explore financing", exact: true }).click();
    await expect(page).toHaveURL(/\/explore\?eligibility=mg-comet-ev&goal=.+&rate=9.5&tenure=48#eligibility$/);
    await expect(page.getByRole("region", { name: "External onboarding status" })).toHaveCount(0);
    await eligibility.getByRole("link", { name: "Loan calculator", exact: true }).click();
    await expect(page.getByLabel("Vehicle price (₹)")).toHaveValue("900000");
    await expect(page.getByLabel("Cash down payment (₹)")).toHaveValue("200000");
    await expect(page.getByLabel("Annual interest (%)")).toHaveValue("9.5");
    await expect(page.getByLabel("Tenure", { exact: true })).toHaveValue("48");
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  const response = await page.request.get("/api/v1/goals");
  const goals = await response.json();
  expect(goals.items.filter((g: { target_model: { id: string } }) => g.target_model.id === "mg-comet-ev")).toHaveLength(1);
});

test("Explore offers an explicit eligibility entry instead of the long EMI disclaimer", async ({ page }) => {
  await page.goto("/explore");
  const entry = page.getByRole("region", { name: "Loan eligibility" });
  await expect(entry).toContainText("You will be asked to fill out your details");
  await expect(entry).not.toContainText("Current lender supports two-wheelers");
  const button = entry.getByRole("link", { name: "Check eligibility with FinStack" });
  const externalUrl = "https://preprod-v2-onboarding.web.app/?url=qMMDJ3";
  await expect(button).toHaveAttribute("href", externalUrl);
  const [cta, copy] = await Promise.all([button.boundingBox(), entry.getByText(/You will be asked to fill out/).boundingBox()]);
  expect(cta!.y + cta!.height).toBeLessThanOrEqual(copy!.y);
  const capture = page.getByRole("region", { name: "Capture a sighting" });
  const backgrounds = await Promise.all([capture.evaluate(el => getComputedStyle(el).backgroundImage), entry.evaluate(el => getComputedStyle(el).backgroundImage)]);
  expect(backgrounds[0]).not.toBe(backgrounds[1]);
  await expect(page.getByText(/\*EMI estimate: catalogue midpoint/)).toHaveCount(0);
  // Exercise the real redirect without starting a third-party application.
  await page.route("https://preprod-v2-onboarding.web.app/**", route => route.fulfill({ contentType: "text/html", body: "<h1>External onboarding test destination</h1>" }));
  await button.click();
  await expect(page).toHaveURL(externalUrl);
  await page.goto("/explore");
  const status = page.getByRole("region", { name: "External onboarding status" });
  await expect(status).toContainText("Onboarding started");
  await expect(status).toContainText("Completion and eligibility results are not synced");
  await expect(entry.getByRole("link", { name: "Continue with FinStack" })).toHaveAttribute("href", externalUrl);
  await page.reload();
  await expect(status).toBeVisible();
});

test("onboarding handoff is acknowledged in Loans and scoped to the account", async ({ page }) => {
  await signUp(page);
  await page.goto("/explore");
  await page.route("https://preprod-v2-onboarding.web.app/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Onboarding test destination</h1>" }));
  await page.getByRole("link", { name: "Check eligibility with FinStack" }).click();
  await expect(page).toHaveURL("https://preprod-v2-onboarding.web.app/?url=qMMDJ3");
  await page.goto("/loans");
  await expect(page.getByRole("region", { name: "External onboarding status" })).toContainText("Onboarding started");
  await page.context().clearCookies();
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: "Explore", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "External onboarding status" })).toHaveCount(0);
});

test("bikes precede cars and vehicle panel financing leads to the eligibility choice", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.locator("#type-bike")).toBeVisible();
  const [bike, car] = await Promise.all([page.locator("#type-bike").boundingBox(), page.locator("#type-car").boundingBox()]);
  expect(bike!.y).toBeLessThan(car!.y);
  await page.getByRole("button", { name: "Explore MG Comet EV", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Explore financing/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/eligibility=mg-comet-ev#eligibility$/);
  await expect(page.getByRole("region", { name: "Loan eligibility" }).getByRole("link", { name: "Loan calculator", exact: true })).toHaveAttribute("href", "/loans?model=mg-comet-ev#emi-calculator");
});

test("Loans vehicle search and live amounts work on mobile", async ({ page }) => {
  await signUp(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/loans#emi-calculator");
  await page.getByRole("combobox", { name: "Search vehicles" }).fill("Swift");
  await page.getByRole("option", { name: /Maruti Suzuki Swift/ }).getByRole("button").click();
  await expect(page.getByText("Selected: Maruti Suzuki Swift")).toBeVisible();
  await page.getByLabel("Vehicle price (₹)").fill("800000");
  await page.getByLabel("Cash down payment (₹)").fill("200000");
  await page.getByLabel("Annual interest (%)").fill("0");
  await page.getByLabel("Tenure", { exact: true }).selectOption("48");
  await expect(page.getByRole("region", { name: "EMI calculator", exact: true }).locator('[aria-live="polite"]')).toContainText("₹12,500");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
