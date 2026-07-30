import { beforeAll, describe, expect, it } from "vitest";
import "@/test/nextMocks";
import { NextRedirectSignal } from "@/test/nextMocks";
import { setupActionTestDb, fakeCookies } from "@/test/actionTestContext";
import { createTestTeacher } from "@/test/factories";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import type { AuthActionState } from "./auth";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const ctx = setupActionTestDb();
let auth: typeof import("./auth");

beforeAll(async () => {
  auth = await import("./auth");
});

const emptyState: AuthActionState = {};

describe("signupAction", () => {
  it("creates a teacher account and redirects to the dashboard on valid input", async () => {
    const fd = formData({ name: "מורה חדשה", email: "new-teacher@example.com", password: "password123" });

    await expect(auth.signupAction(emptyState, fd)).rejects.toBeInstanceOf(NextRedirectSignal);

    const teacher = await ctx.db.teacher.findUnique({ where: { email: "new-teacher@example.com" } });
    expect(teacher).not.toBeNull();
    expect(teacher?.name).toBe("מורה חדשה");
    // A session cookie should have been set as a side effect of signup.
    expect(fakeCookies.get(SESSION_COOKIE_NAME)).toBeDefined();
  });

  it("rejects a missing name without creating an account", async () => {
    const fd = formData({ name: "", email: "no-name@example.com", password: "password123" });
    const result = await auth.signupAction(emptyState, fd);
    expect(result.error).toBeTruthy();
    const teacher = await ctx.db.teacher.findUnique({ where: { email: "no-name@example.com" } });
    expect(teacher).toBeNull();
  });

  it("rejects an invalid email format", async () => {
    const fd = formData({ name: "מורה", email: "not-an-email", password: "password123" });
    const result = await auth.signupAction(emptyState, fd);
    expect(result.error).toBeTruthy();
  });

  it("rejects a password shorter than the minimum length", async () => {
    const fd = formData({ name: "מורה", email: "short-pw@example.com", password: "short" });
    const result = await auth.signupAction(emptyState, fd);
    expect(result.error).toBeTruthy();
    const teacher = await ctx.db.teacher.findUnique({ where: { email: "short-pw@example.com" } });
    expect(teacher).toBeNull();
  });

  it("rejects signup with an email already in use", async () => {
    const { teacher } = await createTestTeacher(ctx.db, { email: "duplicate@example.com" });
    const fd = formData({ name: "מישהי אחרת", email: "duplicate@example.com", password: "password123" });

    const result = await auth.signupAction(emptyState, fd);

    expect(result.error).toBeTruthy();
    const count = await ctx.db.teacher.count({ where: { email: "duplicate@example.com" } });
    expect(count).toBe(1);
    expect(teacher.email).toBe("duplicate@example.com");
  });

  it("treats email matching as case-insensitive", async () => {
    await createTestTeacher(ctx.db, { email: "case-test@example.com" });
    const fd = formData({ name: "מישהי", email: "Case-Test@Example.com", password: "password123" });

    const result = await auth.signupAction(emptyState, fd);

    expect(result.error).toBeTruthy();
  });
});

describe("loginAction", () => {
  it("logs in with correct credentials and redirects to the dashboard", async () => {
    const { teacher, password } = await createTestTeacher(ctx.db, { email: "login-ok@example.com" });
    const fd = formData({ email: teacher.email, password });

    await expect(auth.loginAction(emptyState, fd)).rejects.toBeInstanceOf(NextRedirectSignal);
    expect(fakeCookies.get(SESSION_COOKIE_NAME)).toBeDefined();
  });

  it("rejects an incorrect password without authenticating", async () => {
    const { teacher } = await createTestTeacher(ctx.db, { email: "login-badpw@example.com", password: "correct-password" });
    const fd = formData({ email: teacher.email, password: "wrong-password" });

    const result = await auth.loginAction(emptyState, fd);

    expect(result.error).toBeTruthy();
    expect(fakeCookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("rejects a login attempt for an email that doesn't exist", async () => {
    const fd = formData({ email: "nobody@example.com", password: "whatever123" });

    const result = await auth.loginAction(emptyState, fd);

    expect(result.error).toBeTruthy();
    expect(fakeCookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("rejects login for a disabled teacher even with the correct password", async () => {
    const { teacher, password } = await createTestTeacher(ctx.db, {
      email: "disabled-teacher@example.com",
      password: "correct-password",
    });
    await ctx.db.teacher.update({ where: { id: teacher.id }, data: { isDisabled: true } });

    const fd = formData({ email: teacher.email, password });
    const result = await auth.loginAction(emptyState, fd);

    expect(result.error).toBeTruthy();
    expect(fakeCookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });
});

describe("signupAction — rate limiting", () => {
  it("blocks further signups from the same IP once the threshold is exceeded", async () => {
    for (let i = 0; i < 5; i++) {
      const fd = formData({ name: "מורה", email: `rate-limit-${i}@example.com`, password: "password123" });
      await expect(auth.signupAction(emptyState, fd)).rejects.toBeInstanceOf(NextRedirectSignal);
    }

    const fd = formData({ name: "מורה", email: "rate-limit-blocked@example.com", password: "password123" });
    const result = await auth.signupAction(emptyState, fd);

    expect(result.error).toBeTruthy();
    const teacher = await ctx.db.teacher.findUnique({ where: { email: "rate-limit-blocked@example.com" } });
    expect(teacher).toBeNull();
  });
});

describe("loginAction — rate limiting", () => {
  it("blocks further attempts for the same email even with the correct password, once the threshold is exceeded", async () => {
    const { teacher, password } = await createTestTeacher(ctx.db, {
      email: "rate-limit-login@example.com",
      password: "correct-password",
    });

    for (let i = 0; i < 5; i++) {
      const fd = formData({ email: teacher.email, password: "wrong-password" });
      const result = await auth.loginAction(emptyState, fd);
      expect(result.error).toBeTruthy();
    }

    const fd = formData({ email: teacher.email, password });
    const result = await auth.loginAction(emptyState, fd);

    expect(result.error).toBeTruthy();
    expect(fakeCookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });
});

describe("logoutAction", () => {
  it("clears the session cookie and redirects to login", async () => {
    const { teacher, password } = await createTestTeacher(ctx.db, { email: "logout-test@example.com" });
    const fd = formData({ email: teacher.email, password });
    await expect(auth.loginAction(emptyState, fd)).rejects.toBeInstanceOf(NextRedirectSignal);
    expect(fakeCookies.get(SESSION_COOKIE_NAME)).toBeDefined();

    await expect(auth.logoutAction()).rejects.toBeInstanceOf(NextRedirectSignal);

    expect(fakeCookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });
});
