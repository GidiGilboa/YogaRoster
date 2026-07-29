import type { BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export type TeacherAccount = { name: string; email: string; password: string };

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function signupTeacher(page: Page, overrides: Partial<TeacherAccount> = {}): Promise<TeacherAccount> {
  const account: TeacherAccount = {
    name: overrides.name ?? "מורה בדיקה",
    email: overrides.email ?? `teacher-${uniqueSuffix()}@example.com`,
    password: overrides.password ?? "password123",
  };

  await page.goto("/signup");
  await page.getByLabel("שם").fill(account.name);
  await page.getByLabel("אימייל").fill(account.email);
  await page.getByLabel("סיסמה").fill(account.password);
  await page.getByRole("button", { name: "יצירת חשבון" }).click();
  await page.waitForURL("**/dashboard");

  return account;
}

/**
 * Creates a lesson via the dashboard UI. Always schedules it for tomorrow
 * (falling back to a late time slot today if today is Saturday, the last
 * selectable day in the current-week picker) so the lesson is guaranteed to
 * be in the future regardless of what day/time the suite happens to run.
 */
export async function createLessonViaUI(
  page: Page,
  opts: { title: string; capacity: number; duration?: 45 | 60 | 75 | 90 }
): Promise<void> {
  const DAY_LETTERS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
  const todayIndex = new Date().getDay();
  const isSaturday = todayIndex === 6;
  const targetIndex = isSaturday ? 6 : todayIndex + 1;

  await page.goto("/dashboard/lessons");
  await page.getByRole("button", { name: "+ הוספת שיעור" }).click();

  await page.getByLabel("כותרת השיעור").fill(opts.title);
  await page.getByText(`יום ${DAY_LETTERS[targetIndex]}`, { exact: false }).click();
  if (isSaturday) {
    await page.getByLabel("שעת התחלה").fill("23:55");
  }
  if (opts.duration) {
    await page.getByLabel("משך").selectOption(String(opts.duration));
  }
  await page.getByLabel("מספר מקומות מקסימלי").fill(String(opts.capacity));

  await page.getByRole("button", { name: "יצירת שיעור" }).click();
  await expect(page.getByText(opts.title)).toBeVisible();
}

export async function addStudentViaUI(
  page: Page,
  opts: { firstName: string; lastName: string; phone: string; credits?: number }
): Promise<void> {
  await page.goto("/dashboard/students");
  await page.getByRole("button", { name: "+ הוספת תלמידה" }).click();
  await page.getByLabel("שם פרטי").fill(opts.firstName);
  await page.getByLabel("שם משפחה").fill(opts.lastName);
  await page.getByLabel("טלפון").fill(opts.phone);
  if (opts.credits !== undefined) {
    await page.getByLabel("יתרת שיעורים").fill(String(opts.credits));
  }
  await page.getByRole("button", { name: "הוספת תלמידה", exact: true }).click();
  await expect(page.getByText(`${opts.firstName} ${opts.lastName}`)).toBeVisible();
}

/**
 * Publishes the current week from the dashboard and returns the plan URL
 * the teacher would share, by reading it straight off the clipboard just
 * like a real teacher copying it into WhatsApp.
 */
export async function publishWeekAndGetLink(page: Page, context: BrowserContext): Promise<string> {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/dashboard/lessons");
  await page.getByRole("button", { name: "פרסם לקהילה" }).click();

  let link = "";
  await expect
    .poll(async () => {
      link = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
      return link;
    })
    .not.toBe("");

  return link;
}

export async function identifyAsStudent(page: Page, planUrl: string, opts: { name: string; phone: string }): Promise<void> {
  await page.goto(planUrl);
  await page.waitForURL("**/identify**");
  await page.getByLabel("שם מלא").fill(opts.name);
  await page.getByLabel("טלפון").fill(opts.phone);
  await page.getByRole("button", { name: "המשך" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/identify"));
}
