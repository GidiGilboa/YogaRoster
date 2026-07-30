import { beforeAll, describe, expect, it } from "vitest";
import "@/test/nextMocks";
import { NextRedirectSignal } from "@/test/nextMocks";
import { setupActionTestDb, fakeCookies } from "@/test/actionTestContext";
import { createTestTeacher } from "@/test/factories";

const ADMIN_USERNAME = "test-admin";
const ADMIN_PASSWORD = "test-admin-password-123";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const ctx = setupActionTestDb();
let admin: typeof import("./admin");
let session: typeof import("@/lib/session");
let libAuth: typeof import("@/lib/auth");
let ADMIN_SESSION_COOKIE_NAME: string;

beforeAll(async () => {
  const authLib = await import("@/lib/auth");
  process.env.ADMIN_USERNAME = ADMIN_USERNAME;
  process.env.ADMIN_PASSWORD_HASH = await authLib.hashPassword(ADMIN_PASSWORD);

  admin = await import("./admin");
  session = await import("@/lib/session");
  libAuth = authLib;
  ({ ADMIN_SESSION_COOKIE_NAME } = await import("@/lib/adminAuth"));
});

async function loginAsAdmin() {
  const fd = formData({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
  await expect(admin.adminLoginAction({}, fd)).rejects.toBeInstanceOf(NextRedirectSignal);
}

describe("adminLoginAction", () => {
  it("logs in with correct credentials and sets the admin session cookie", async () => {
    const fd = formData({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });

    await expect(admin.adminLoginAction({}, fd)).rejects.toBeInstanceOf(NextRedirectSignal);

    expect(fakeCookies.get(ADMIN_SESSION_COOKIE_NAME)).toBeDefined();
  });

  it("rejects an incorrect password", async () => {
    const fd = formData({ username: ADMIN_USERNAME, password: "wrong-password" });

    const result = await admin.adminLoginAction({}, fd);

    expect(result.error).toBeTruthy();
    expect(fakeCookies.get(ADMIN_SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("rejects an incorrect username", async () => {
    const fd = formData({ username: "not-the-admin", password: ADMIN_PASSWORD });

    const result = await admin.adminLoginAction({}, fd);

    expect(result.error).toBeTruthy();
  });

  it("blocks further attempts once the rate limit is exceeded, even with correct credentials", async () => {
    for (let i = 0; i < 5; i++) {
      const fd = formData({ username: ADMIN_USERNAME, password: "wrong-password" });
      const result = await admin.adminLoginAction({}, fd);
      expect(result.error).toBeTruthy();
    }

    const fd = formData({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    const result = await admin.adminLoginAction({}, fd);

    expect(result.error).toBeTruthy();
    expect(fakeCookies.get(ADMIN_SESSION_COOKIE_NAME)).toBeUndefined();
  });
});

describe("adminLogoutAction", () => {
  it("clears the admin session cookie", async () => {
    await loginAsAdmin();
    expect(fakeCookies.get(ADMIN_SESSION_COOKIE_NAME)).toBeDefined();

    await expect(admin.adminLogoutAction()).rejects.toBeInstanceOf(NextRedirectSignal);

    expect(fakeCookies.get(ADMIN_SESSION_COOKIE_NAME)).toBeUndefined();
  });
});

describe("adminUpdateTeacherAction", () => {
  it("requires an active admin session", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const fd = formData({
      name: "שם",
      email: teacher.email,
      appName: "אפליקציה",
      defaultLessonCapacity: "10",
      defaultLessonDuration: "60",
    });

    await expect(admin.adminUpdateTeacherAction(teacher.id, {}, fd)).rejects.toBeInstanceOf(NextRedirectSignal);
  });

  it("updates a teacher's fields", async () => {
    await loginAsAdmin();
    const { teacher } = await createTestTeacher(ctx.db, { email: "before-admin-edit@example.com" });

    const fd = formData({
      name: "שם עודכן על ידי מנהל",
      email: "after-admin-edit@example.com",
      appName: "אפליקציה חדשה",
      defaultLessonCapacity: "15",
      defaultLessonDuration: "30",
    });
    const result = await admin.adminUpdateTeacherAction(teacher.id, {}, fd);

    expect(result.error).toBeUndefined();
    const updated = await ctx.db.teacher.findUnique({ where: { id: teacher.id } });
    expect(updated?.name).toBe("שם עודכן על ידי מנהל");
    expect(updated?.email).toBe("after-admin-edit@example.com");
    expect(updated?.defaultLessonCapacity).toBe(15);
  });

  it("rejects an email already used by another teacher", async () => {
    await loginAsAdmin();
    await createTestTeacher(ctx.db, { email: "admin-taken@example.com" });
    const { teacher } = await createTestTeacher(ctx.db, { email: "admin-mine@example.com" });

    const fd = formData({
      name: "שם",
      email: "admin-taken@example.com",
      appName: "אפליקציה",
      defaultLessonCapacity: "10",
      defaultLessonDuration: "60",
    });
    const result = await admin.adminUpdateTeacherAction(teacher.id, {}, fd);

    expect(result.error).toBeTruthy();
  });

  it("rejects invalid input", async () => {
    await loginAsAdmin();
    const { teacher } = await createTestTeacher(ctx.db);

    const fd = formData({
      name: "",
      email: teacher.email,
      appName: "אפליקציה",
      defaultLessonCapacity: "10",
      defaultLessonDuration: "60",
    });
    const result = await admin.adminUpdateTeacherAction(teacher.id, {}, fd);

    expect(result.error).toBeTruthy();
  });

  it("returns an error for a nonexistent teacher", async () => {
    await loginAsAdmin();
    const fd = formData({
      name: "שם",
      email: "someone@example.com",
      appName: "אפליקציה",
      defaultLessonCapacity: "10",
      defaultLessonDuration: "60",
    });

    const result = await admin.adminUpdateTeacherAction("nonexistent-id", {}, fd);

    expect(result.error).toBeTruthy();
  });
});

describe("adminSetTeacherDisabledAction", () => {
  it("requires an active admin session", async () => {
    const { teacher } = await createTestTeacher(ctx.db);

    await expect(admin.adminSetTeacherDisabledAction(teacher.id, true)).rejects.toBeInstanceOf(NextRedirectSignal);
  });

  it("disables and re-enables a teacher", async () => {
    await loginAsAdmin();
    const { teacher } = await createTestTeacher(ctx.db);

    const disableResult = await admin.adminSetTeacherDisabledAction(teacher.id, true);
    expect(disableResult.error).toBeUndefined();
    let updated = await ctx.db.teacher.findUnique({ where: { id: teacher.id } });
    expect(updated?.isDisabled).toBe(true);

    const enableResult = await admin.adminSetTeacherDisabledAction(teacher.id, false);
    expect(enableResult.error).toBeUndefined();
    updated = await ctx.db.teacher.findUnique({ where: { id: teacher.id } });
    expect(updated?.isDisabled).toBe(false);
  });

  it("disabling a teacher immediately invalidates her active session, not just future logins", async () => {
    await loginAsAdmin();
    const { teacher } = await createTestTeacher(ctx.db);

    // Simulate the teacher already being logged in with a valid session
    // cookie, alongside the admin's own cookie — a real browser would hold
    // both at once (different cookie names), so don't clear the jar here.
    await session.createSession(teacher.id);
    expect(await libAuth.getCurrentTeacher()).not.toBeNull();

    await admin.adminSetTeacherDisabledAction(teacher.id, true);

    expect(await libAuth.getCurrentTeacher()).toBeNull();
  });
});
