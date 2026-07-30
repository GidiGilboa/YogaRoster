import { access, unlink } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import "@/test/nextMocks";
import { NextRedirectSignal } from "@/test/nextMocks";
import { setupActionTestDb } from "@/test/actionTestContext";
import { createTestTeacher } from "@/test/factories";
import type { SettingsActionState } from "./settings";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const ctx = setupActionTestDb();
let settings: typeof import("./settings");
let session: typeof import("@/lib/session");

beforeAll(async () => {
  settings = await import("./settings");
  session = await import("@/lib/session");
});

async function loginAs(teacherId: string) {
  await session.createSession(teacherId);
}

const emptyState: SettingsActionState = {};
const uploadedFiles: string[] = [];

afterEach(async () => {
  for (const filePath of uploadedFiles.splice(0)) {
    await unlink(filePath).catch(() => {});
  }
});

let emailCounter = 0;

function baseFields(overrides: Record<string, string> = {}) {
  emailCounter += 1;
  return {
    name: "מורה מעודכנת",
    email: `updated-${emailCounter}@example.com`,
    phone: "",
    appName: "הסטודיו שלי",
    defaultLessonCapacity: "8",
    defaultLessonDuration: "45",
    ...overrides,
  };
}

describe("updateSettingsAction — validation and persistence", () => {
  it("saves valid settings", async () => {
    const { teacher } = await createTestTeacher(ctx.db, { email: "before@example.com" });
    await loginAs(teacher.id);
    const fields = baseFields();

    const result = await settings.updateSettingsAction(emptyState, formData(fields));

    expect(result.error).toBeUndefined();
    const updated = await ctx.db.teacher.findUnique({ where: { id: teacher.id } });
    expect(updated?.name).toBe("מורה מעודכנת");
    expect(updated?.email).toBe(fields.email);
    expect(updated?.appName).toBe("הסטודיו שלי");
    expect(updated?.defaultLessonCapacity).toBe(8);
    expect(updated?.defaultLessonDuration).toBe(45);
    expect(updated?.phone).toBeNull();
  });

  it("saves a valid phone number, normalized", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const result = await settings.updateSettingsAction(emptyState, formData(baseFields({ phone: "050-999-8888" })));

    expect(result.error).toBeUndefined();
    const updated = await ctx.db.teacher.findUnique({ where: { id: teacher.id } });
    expect(updated?.phone).toBe("0509998888");
  });

  it("rejects a malformed phone number", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const result = await settings.updateSettingsAction(emptyState, formData(baseFields({ phone: "123" })));

    expect(result.error).toBeTruthy();
  });

  it("rejects a missing name", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const result = await settings.updateSettingsAction(emptyState, formData(baseFields({ name: "" })));

    expect(result.error).toBeTruthy();
  });

  it("rejects an invalid email format", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const result = await settings.updateSettingsAction(emptyState, formData(baseFields({ email: "not-an-email" })));

    expect(result.error).toBeTruthy();
  });

  it("rejects an empty application name", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const result = await settings.updateSettingsAction(emptyState, formData(baseFields({ appName: "" })));

    expect(result.error).toBeTruthy();
  });

  it("rejects a non-positive default lesson capacity", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const result = await settings.updateSettingsAction(
      emptyState,
      formData(baseFields({ defaultLessonCapacity: "0" }))
    );

    expect(result.error).toBeTruthy();
  });

  it("rejects a non-positive default lesson duration", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const result = await settings.updateSettingsAction(
      emptyState,
      formData(baseFields({ defaultLessonDuration: "-5" }))
    );

    expect(result.error).toBeTruthy();
  });

  it("rejects changing email to one already used by another teacher", async () => {
    await createTestTeacher(ctx.db, { email: "taken@example.com" });
    const { teacher } = await createTestTeacher(ctx.db, { email: "mine@example.com" });
    await loginAs(teacher.id);

    const result = await settings.updateSettingsAction(
      emptyState,
      formData(baseFields({ email: "taken@example.com" }))
    );

    expect(result.error).toBeTruthy();
    const untouched = await ctx.db.teacher.findUnique({ where: { id: teacher.id } });
    expect(untouched?.email).toBe("mine@example.com");
  });

  it("allows saving with the teacher's own unchanged email", async () => {
    const { teacher } = await createTestTeacher(ctx.db, { email: "same@example.com" });
    await loginAs(teacher.id);

    const result = await settings.updateSettingsAction(emptyState, formData(baseFields({ email: "same@example.com" })));

    expect(result.error).toBeUndefined();
  });

  it("redirects to login when no teacher is signed in", async () => {
    await expect(settings.updateSettingsAction(emptyState, formData(baseFields()))).rejects.toBeInstanceOf(
      NextRedirectSignal
    );
  });
});

describe("updateSettingsAction — background image upload", () => {
  it("saves a valid image upload and points backgroundImageUrl at it", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const fd = formData(baseFields());
    const file = new File([new Uint8Array([137, 80, 78, 71])], "bg.png", { type: "image/png" });
    fd.set("backgroundImage", file);

    const result = await settings.updateSettingsAction(emptyState, fd);

    expect(result.error).toBeUndefined();
    const updated = await ctx.db.teacher.findUnique({ where: { id: teacher.id } });
    expect(updated?.backgroundImageUrl).toMatch(new RegExp(`^/uploads/teacher-${teacher.id}\\.png`));

    const savedPath = path.join(process.cwd(), "public", "uploads", `teacher-${teacher.id}.png`);
    uploadedFiles.push(savedPath);
    await expect(access(savedPath)).resolves.toBeUndefined();
  });

  it("rejects a non-image file type without saving it", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const fd = formData(baseFields());
    const file = new File([new Uint8Array([1, 2, 3])], "not-an-image.txt", { type: "text/plain" });
    fd.set("backgroundImage", file);

    const result = await settings.updateSettingsAction(emptyState, fd);

    expect(result.error).toBeTruthy();
    const untouched = await ctx.db.teacher.findUnique({ where: { id: teacher.id } });
    expect(untouched?.backgroundImageUrl).toBeNull();
  });

  it("rejects a file larger than the 5MB limit", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const fd = formData(baseFields());
    const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
    const file = new File([oversized], "huge.png", { type: "image/png" });
    fd.set("backgroundImage", file);

    const result = await settings.updateSettingsAction(emptyState, fd);

    expect(result.error).toBeTruthy();
    const untouched = await ctx.db.teacher.findUnique({ where: { id: teacher.id } });
    expect(untouched?.backgroundImageUrl).toBeNull();
  });

  it("removes an existing background image when requested", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await ctx.db.teacher.update({ where: { id: teacher.id }, data: { backgroundImageUrl: "/uploads/teacher-x.png" } });
    await loginAs(teacher.id);

    const fd = formData(baseFields());
    fd.set("removeBackgroundImage", "on");

    const result = await settings.updateSettingsAction(emptyState, fd);

    expect(result.error).toBeUndefined();
    const updated = await ctx.db.teacher.findUnique({ where: { id: teacher.id } });
    expect(updated?.backgroundImageUrl).toBeNull();
  });
});
