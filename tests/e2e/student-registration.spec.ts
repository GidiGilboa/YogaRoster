import { expect, test } from "@playwright/test";
import { createLessonViaUI, identifyAsStudent, publishWeekAndGetLink, signupTeacher } from "./helpers";

test(
  "new student identifies, registers, and sees a correct confirmation; a second student is waitlisted once the lesson is full",
  { tag: "@fast" },
  async ({ page, context, browser }) => {
    await signupTeacher(page);
    await createLessonViaUI(page, { capacity: 1 });
    const planUrl = await publishWeekAndGetLink(page, context);

    const studentAContext = await browser.newContext();
    const studentA = await studentAContext.newPage();
    await identifyAsStudent(studentA, planUrl, { name: "תלמידה ראשונה", phone: "0501112222" });
    await studentA.getByRole("checkbox").check();
    await studentA.getByRole("button", { name: "עדכון הרשמה" }).click();

    await expect(studentA.getByText("נרשמת בהצלחה")).toBeVisible();
    await expect(studentA.getByText(/יתרת שיעורים: -?\d+/).first()).toBeVisible();

    const studentBContext = await browser.newContext();
    const studentB = await studentBContext.newPage();
    await identifyAsStudent(studentB, planUrl, { name: "תלמידה שנייה", phone: "0502223333" });
    await studentB.getByRole("checkbox").check();
    await studentB.getByRole("button", { name: "עדכון הרשמה" }).click();

    await expect(studentB.getByText("נוספת לרשימת המתנה")).toBeVisible();
    await expect(studentB.getByText("יתרת שיעורים: 0").first()).toBeVisible();

    await studentAContext.close();
    await studentBContext.close();
  }
);

test("a returning student is recognized by her session cookie and skips re-identifying", async ({ page, context, browser }) => {
  await signupTeacher(page);
  await createLessonViaUI(page, { capacity: 5 });
  const planUrl = await publishWeekAndGetLink(page, context);

  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  await identifyAsStudent(student, planUrl, { name: "חוזרת", phone: "0503334444" });
  await expect(student.getByRole("button", { name: "עדכון הרשמה" })).toBeVisible();

  await student.goto(planUrl);

  await expect(student).not.toHaveURL(/identify/);
  await expect(student.getByRole("button", { name: "עדכון הרשמה" })).toBeVisible();

  await studentContext.close();
});
