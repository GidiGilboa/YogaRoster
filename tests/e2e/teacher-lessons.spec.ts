import { expect, test } from "@playwright/test";
import { createLessonViaUI, signupTeacher } from "./helpers";

test(
  "teacher creates a week of lessons, then copies it into the next week",
  { tag: "@fast" },
  async ({ page }) => {
    await signupTeacher(page);

    await createLessonViaUI(page, { comment: "שיעור בוקר לשכפול", capacity: 8, duration: 60 });
    await expect(page.getByText("שיעור בוקר לשכפול")).toBeVisible();

    // Move to next week and copy this week's plan into it.
    await page.getByRole("link", { name: "שבוע הבא" }).click();
    await expect(page.getByText("שיעור בוקר לשכפול")).not.toBeVisible();

    await page.getByRole("button", { name: "העתק משבוע קודם" }).click();

    await expect(page.getByText("שיעור בוקר לשכפול")).toBeVisible();
    await expect(page.getByText(/8 נרשמו/)).toBeVisible();
  }
);
