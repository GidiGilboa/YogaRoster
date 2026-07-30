import { expect, test } from "@playwright/test";
import { addStudentViaUI, createLessonViaUI, publishWeekAndGetLink, signupTeacher } from "./helpers";

test(
  "teacher links a student to register for another; the linked student can see and switch to who she registers for",
  { tag: "@fast" },
  async ({ page, context, browser }) => {
    await signupTeacher(page);
    await addStudentViaUI(page, { firstName: "רשמת", lastName: "ראשית", phone: "0508881111", credits: 5 });
    await addStudentViaUI(page, { firstName: "תלויה", lastName: "שנייה", phone: "0508882222", credits: 3 });

    // Link "תלויה שנייה" as someone "רשמת ראשית" can register for.
    await page.getByText("רשמת ראשית").click();
    await page.getByRole("combobox").selectOption({ label: "תלויה שנייה" });
    await page.getByRole("button", { name: "הוספה" }).click();
    // "תלויה שנייה" text also matches the (soon-to-be-removed) dropdown
    // option, so assert on the remove button that only exists in the linked
    // row to avoid a strict-mode ambiguity.
    await expect(page.getByRole("button", { name: "הסרה" })).toBeVisible();
    await page.getByRole("button", { name: "ביטול" }).click();

    await createLessonViaUI(page, { capacity: 5 });
    const planUrl = await publishWeekAndGetLink(page, context);

    const studentContext = await browser.newContext();
    const student = await studentContext.newPage();
    await student.goto(planUrl);
    await student.waitForURL("**/identify**");
    await student.getByLabel("שם מלא").fill("רשמת ראשית");
    await student.getByLabel("טלפון").fill("0508881111");
    await student.getByRole("button", { name: "המשך" }).click();
    await student.waitForURL((url) => !url.pathname.includes("/identify"));

    // Registrar's own tab is active by default; she can see her balance.
    await expect(student.getByText("יתרת שיעורים: 5")).toBeVisible();
    await expect(student.getByText("תלויה", { exact: false })).toBeVisible();

    // Switch to the dependent's tab — the whole context (balance, lesson list) updates.
    await student.getByRole("link", { name: "תלויה" }).click();
    await expect(student.getByText("יתרת שיעורים: 3")).toBeVisible();

    await student.getByRole("checkbox").check();
    await student.getByRole("button", { name: "עדכון הרשמה" }).click();
    await expect(student.getByText("נרשמת בהצלחה")).toBeVisible();

    // The registration and credit deduction landed on the dependent...
    await expect(student.getByText("יתרת שיעורים: 2").first()).toBeVisible();

    // ...and not on the registrar, who is untouched.
    await student.getByRole("link", { name: "רשמת", exact: false }).click();
    await expect(student.getByText("יתרת שיעורים: 5")).toBeVisible();

    await studentContext.close();
  }
);
