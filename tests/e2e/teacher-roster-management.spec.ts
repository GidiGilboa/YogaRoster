import { expect, test } from "@playwright/test";
import { addStudentViaUI, createLessonViaUI, signupTeacher } from "./helpers";

test(
  "teacher manually registers and unregisters a student from a lesson's roster, and capacity blocks a further add",
  { tag: "@fast" },
  async ({ page }) => {
    await signupTeacher(page);
    await createLessonViaUI(page, { comment: "שיעור לניהול רשימה", capacity: 1 });
    await addStudentViaUI(page, { firstName: "תלמידה", lastName: "אחת", phone: "0504445555" });
    await addStudentViaUI(page, { firstName: "תלמידה", lastName: "שתיים", phone: "0505556666" });

    await page.goto("/dashboard/lessons");
    await page.getByText("שיעור לניהול רשימה").click();
    // A brand-new lesson has no registrations yet, so it opens in the edit form.
    await page.getByRole("button", { name: "תלמידות" }).click();

    await page.getByRole("button", { name: "+ רישום תלמידה לשיעור" }).click();
    await page.getByRole("combobox").selectOption({ label: "תלמידה אחת" });
    await page.getByRole("button", { name: "הוספה" }).click();

    await expect(page.getByText("תלמידה אחת")).toBeVisible();
    await expect(page.getByText("מתוך 1")).toBeVisible();

    // Close and reopen the lesson: with a live registration now on it, it
    // should land directly in the roster view (undocumented behavior — see
    // qa-test-plan.md), not the edit form.
    await page.getByRole("button", { name: "ביטול" }).click();
    await page.getByText("שיעור לניהול רשימה").click();
    await expect(page.getByText("תלמידה אחת")).toBeVisible();
    await expect(page.getByRole("button", { name: "תלמידות" })).not.toBeVisible();

    // Lesson is now at capacity — manually adding the second student must be blocked.
    await page.getByRole("button", { name: "+ רישום תלמידה לשיעור" }).click();
    await page.getByRole("combobox").selectOption({ label: "תלמידה שתיים" });
    await page.getByRole("button", { name: "הוספה" }).click();
    await expect(page.getByText("השיעור מלא, לא ניתן להוסיף תלמידה נוספת.")).toBeVisible();
    await expect(page.getByText("תלמידה שתיים")).not.toBeVisible();

    // Unregistering frees the spot again.
    await page.getByRole("button", { name: "בטל רישום" }).click();
    await expect(page.getByText("אין עדיין תלמידות רשומות.")).toBeVisible();
  }
);

test("teacher adjusts a student's credit balance from her edit form", { tag: "@fast" }, async ({ page }) => {
  await signupTeacher(page);
  await addStudentViaUI(page, { firstName: "תלמידה", lastName: "יתרה", phone: "0506667777", credits: 3 });

  await page.getByText("תלמידה יתרה").click();
  await page.getByLabel("יתרת שיעורים").fill("15");
  await page.getByRole("button", { name: "שמירת שינויים" }).click();

  await expect(page.getByText("15", { exact: true })).toBeVisible();
});
