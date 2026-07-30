import { expect, test } from "@playwright/test";
import { signupTeacher } from "./helpers";

const ADMIN_USERNAME = "e2e-admin";
const ADMIN_PASSWORD = "e2e-admin-password-123";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  // Same rationale as signupTeacher in helpers.ts: admin login is rate
  // limited by IP, and the dev server can be reused across repeated local
  // test runs (reuseExistingServer), so give each run its own synthetic IP.
  await page.context().setExtraHTTPHeaders({
    "x-forwarded-for": `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
  });
  await page.goto("/admin/login");
  await page.getByLabel("שם משתמש").fill(ADMIN_USERNAME);
  await page.getByLabel("סיסמה").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "התחברות" }).click();
  await page.waitForURL("**/admin");
}

test("unauthenticated visitors are redirected to the admin login screen", { tag: "@fast" }, async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test(
  "admin logs in, edits a teacher's attributes, and disables/re-enables her account",
  { tag: "@fast" },
  async ({ page, context }) => {
    const teacherAccount = await signupTeacher(page, { name: "מורה לניהול מנהל" });
    await page.getByRole("button", { name: "התנתקות" }).click();

    // A fresh context so the admin login doesn't reuse the teacher's cookies.
    const adminContext = await context.browser()!.newContext();
    const adminPage = await adminContext.newPage();
    await loginAsAdmin(adminPage);

    await expect(adminPage.getByText(teacherAccount.email)).toBeVisible();
    await adminPage.getByText("מורה לניהול מנהל").click();

    await adminPage.getByLabel("שם המורה").fill("מורה אחרי עריכת מנהל");
    await adminPage.getByRole("button", { name: "שמירת שינויים" }).click();
    await expect(adminPage.getByText("מורה אחרי עריכת מנהל")).toBeVisible();

    // Disable the account and confirm the teacher can no longer log in.
    await adminPage.getByText("מורה אחרי עריכת מנהל").click();
    await adminPage.getByRole("button", { name: "השבתת חשבון" }).click();
    await adminPage.getByRole("button", { name: "כן, השבתה" }).click();
    await expect(adminPage.getByText("מושבת").first()).toBeVisible();

    const loginPage = await adminContext.newPage();
    await loginPage.goto("/login");
    await loginPage.getByLabel("אימייל").fill(teacherAccount.email);
    await loginPage.getByLabel("סיסמה").fill(teacherAccount.password);
    await loginPage.getByRole("button", { name: "התחברות" }).click();
    await expect(loginPage.getByText("חשבון זה הושבת")).toBeVisible();

    // The modal is still open on this teacher (now offering re-enable) —
    // no need to close and reopen it.
    await adminPage.getByRole("button", { name: "הפעלת חשבון מחדש" }).click();
    await expect(adminPage.getByRole("button", { name: "השבתת חשבון" })).toBeVisible();
    await adminPage.getByRole("button", { name: "ביטול" }).click();
    await expect(adminPage.getByText("מושבת")).not.toBeVisible();

    await loginPage.goto("/login");
    await loginPage.getByLabel("אימייל").fill(teacherAccount.email);
    await loginPage.getByLabel("סיסמה").fill(teacherAccount.password);
    await loginPage.getByRole("button", { name: "התחברות" }).click();
    await loginPage.waitForURL("**/dashboard");

    await adminContext.close();
  }
);
