import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createLessonViaUI, publishWeekAndGetLink, signupTeacher } from "./helpers";

test(
  "teacher edits her settings and sees them reflected in the greeting, header, and new-lesson defaults",
  { tag: "@fast" },
  async ({ page }) => {
    await signupTeacher(page, { name: "מורה מקורית" });
    await expect(page.getByRole("heading", { name: "היי, מורה מקורית" })).toBeVisible();
    await expect(page.locator("header").getByText("Yoga Roster")).toBeVisible();

    await page.getByRole("button", { name: "הגדרות" }).click();
    await page.getByLabel("שם המורה").fill("מורה מעודכנת");
    await page.getByLabel("שם האפליקציה").fill("סטודיו הבדיקה");
    await page.getByLabel("מספר מקומות ברירת מחדל").fill("6");
    await page.getByLabel("משך שיעור ברירת מחדל", { exact: false }).fill("50");
    await page.getByRole("button", { name: "שמירת שינויים" }).click();

    await expect(page.getByRole("heading", { name: "היי, מורה מעודכנת" })).toBeVisible();
    await expect(page.locator("header").getByText("סטודיו הבדיקה")).toBeVisible();

    await page.goto("/dashboard/lessons");
    await page.getByRole("button", { name: "+ הוספת שיעור" }).click();
    await expect(page.getByLabel("מספר מקומות מקסימלי")).toHaveValue("6");
    await expect(page.getByLabel("משך", { exact: true })).toHaveValue("50");
  }
);

test(
  "teacher uploads a background image and it appears on the student-facing pages",
  { tag: "@fast" },
  async ({ page, context, browser }) => {
    await signupTeacher(page);
    await createLessonViaUI(page, { capacity: 5 });
    const planUrl = await publishWeekAndGetLink(page, context);

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "הגדרות" }).click();
    await page.locator('input[name="backgroundImage"]').setInputFiles(path.join(__dirname, "fixtures", "background.png"));
    await page.getByRole("button", { name: "שמירת שינויים" }).click();
    await expect(page.getByRole("button", { name: "הגדרות" })).toBeVisible();

    // Reopening settings shows the saved image and a way to remove it.
    await page.getByRole("button", { name: "הגדרות" }).click();
    await expect(page.getByRole("button", { name: "הסרת תמונה" })).toBeVisible();
    await page.getByRole("button", { name: "ביטול" }).click();

    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    await studentPage.goto(planUrl);
    await studentPage.waitForURL("**/identify**");
    await expect(studentPage.locator("main")).toHaveCSS("background-image", /url\(/);

    await studentContext.close();
  }
);

test(
  "a ~2MB background image upload succeeds (regression: Next's default 1MB Server Action body limit)",
  { tag: "@fast" },
  async ({ page }) => {
    // Generated at test-time rather than committed to the repo: a valid
    // tiny PNG with ~2MB of trailing padding, which decoders ignore since
    // they stop reading at the PNG's IEND chunk. Big enough to have failed
    // under the framework's 1MB default before next.config.ts raised
    // serverActions.bodySizeLimit to 6mb, small enough to stay under this
    // app's own 5MB validation ceiling in settings.ts.
    const dir = mkdtempSync(path.join(tmpdir(), "yogaroster-e2e-fixture-"));
    const largeImagePath = path.join(dir, "large-background.png");
    const basePng = readFileSync(path.join(__dirname, "fixtures", "background.png"));
    writeFileSync(largeImagePath, Buffer.concat([basePng, Buffer.alloc(2 * 1024 * 1024)]));

    try {
      await signupTeacher(page);
      await page.getByRole("button", { name: "הגדרות" }).click();
      await page.locator('input[name="backgroundImage"]').setInputFiles(largeImagePath);
      await page.getByRole("button", { name: "שמירת שינויים" }).click();

      await expect(page.getByText("Body exceeded 1 MB limit")).not.toBeVisible();
      await expect(page.getByRole("button", { name: "הגדרות" })).toBeVisible({ timeout: 15_000 });
    } finally {
      // Windows can briefly hold the file handle after the multipart
      // request completes; this is best-effort OS-temp-dir hygiene, not a
      // correctness concern, so don't let a cleanup failure mask (or be
      // mistaken for) a real assertion failure above.
      try {
        rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch (cleanupError) {
        console.warn("fixture cleanup failed, leaving it for OS cleanup:", cleanupError);
      }
    }
  }
);
