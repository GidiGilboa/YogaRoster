import { beforeAll, describe, expect, it } from "vitest";
import "@/test/nextMocks";
import { setupActionTestDb } from "@/test/actionTestContext";
import { createTestLesson, createTestStudent, createTestTeacher } from "@/test/factories";
import type { StudentActionState } from "./students";

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const ctx = setupActionTestDb();
let students: typeof import("./students");
let session: typeof import("@/lib/session");

beforeAll(async () => {
  students = await import("./students");
  session = await import("@/lib/session");
});

async function loginAs(teacherId: string) {
  await session.createSession(teacherId);
}

const emptyState: StudentActionState = {};

describe("createStudentAction", () => {
  it("creates a student with valid input", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const fd = formData({
      firstName: "נועה",
      lastName: "כהן",
      phone: "050-111-2222",
      email: "noa@example.com",
      credits: "10",
    });
    const result = await students.createStudentAction(emptyState, fd);

    expect(result.error).toBeUndefined();
    const created = await ctx.db.student.findFirst({ where: { teacherId: teacher.id } });
    expect(created?.firstName).toBe("נועה");
    // Phone is normalized to digits-only before storage.
    expect(created?.phone).toBe("0501112222");
    expect(created?.credits).toBe(10);
  });

  it("rejects a missing first name", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const fd = formData({ firstName: "", lastName: "כהן", phone: "0501112222", email: "", credits: "0" });
    const result = await students.createStudentAction(emptyState, fd);

    expect(result.error).toBeTruthy();
  });

  it("rejects a missing last name", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const fd = formData({ firstName: "נועה", lastName: "", phone: "0501112222", email: "", credits: "0" });
    const result = await students.createStudentAction(emptyState, fd);

    expect(result.error).toBeTruthy();
  });

  it("rejects a malformed phone number", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const fd = formData({ firstName: "נועה", lastName: "כהן", phone: "123", email: "", credits: "0" });
    const result = await students.createStudentAction(emptyState, fd);

    expect(result.error).toBeTruthy();
  });

  it("rejects a phone number not starting with 05", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const fd = formData({ firstName: "נועה", lastName: "כהן", phone: "0221234567", email: "", credits: "0" });
    const result = await students.createStudentAction(emptyState, fd);

    expect(result.error).toBeTruthy();
  });

  it("rejects an invalid email when provided", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const fd = formData({ firstName: "נועה", lastName: "כהן", phone: "0501112222", email: "not-an-email", credits: "0" });
    const result = await students.createStudentAction(emptyState, fd);

    expect(result.error).toBeTruthy();
  });

  it("allows a missing email (optional field)", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const fd = formData({ firstName: "נועה", lastName: "כהן", phone: "0501112222", email: "", credits: "0" });
    const result = await students.createStudentAction(emptyState, fd);

    expect(result.error).toBeUndefined();
  });

  it("rejects a duplicate phone number for the same teacher", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    await createTestStudent(ctx.db, teacher.id, { phone: "0501112222" });

    const fd = formData({ firstName: "אחרת", lastName: "מישהי", phone: "050-111-2222", email: "", credits: "0" });
    const result = await students.createStudentAction(emptyState, fd);

    expect(result.error).toBeTruthy();
    const count = await ctx.db.student.count({ where: { teacherId: teacher.id, phone: "0501112222" } });
    expect(count).toBe(1);
  });

  it("allows the same phone number to belong to different students under different teachers (multi-tenant isolation)", async () => {
    const { teacher: teacherA } = await createTestTeacher(ctx.db);
    const { teacher: teacherB } = await createTestTeacher(ctx.db);
    await createTestStudent(ctx.db, teacherA.id, { phone: "0501112222" });

    await loginAs(teacherB.id);
    const fd = formData({ firstName: "תלמידה", lastName: "אחרת", phone: "0501112222", email: "", credits: "0" });
    const result = await students.createStudentAction(emptyState, fd);

    expect(result.error).toBeUndefined();
    const countB = await ctx.db.student.count({ where: { teacherId: teacherB.id, phone: "0501112222" } });
    expect(countB).toBe(1);
  });
});

describe("updateStudentAction", () => {
  it("updates an existing student's fields", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    const student = await createTestStudent(ctx.db, teacher.id, { firstName: "לפני", credits: 2 });

    const fd = formData({ firstName: "אחרי", lastName: student.lastName, phone: student.phone, email: "", credits: "20" });
    const result = await students.updateStudentAction(student.id, emptyState, fd);

    expect(result.error).toBeUndefined();
    const updated = await ctx.db.student.findUnique({ where: { id: student.id } });
    expect(updated?.firstName).toBe("אחרי");
    expect(updated?.credits).toBe(20);
  });

  it("allows a negative-adjacent zero balance and does not clamp credits (teacher can set any non-negative value)", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    const student = await createTestStudent(ctx.db, teacher.id, { credits: 5 });

    const fd = formData({ firstName: student.firstName, lastName: student.lastName, phone: student.phone, email: "", credits: "0" });
    const result = await students.updateStudentAction(student.id, emptyState, fd);

    expect(result.error).toBeUndefined();
    const updated = await ctx.db.student.findUnique({ where: { id: student.id } });
    expect(updated?.credits).toBe(0);
  });

  it("rejects a negative credits value", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    const student = await createTestStudent(ctx.db, teacher.id);

    const fd = formData({ firstName: student.firstName, lastName: student.lastName, phone: student.phone, email: "", credits: "-3" });
    const result = await students.updateStudentAction(student.id, emptyState, fd);

    expect(result.error).toBeTruthy();
  });

  it("does not allow a teacher to edit another teacher's student (multi-tenant isolation)", async () => {
    const { teacher: owner } = await createTestTeacher(ctx.db);
    const { teacher: intruder } = await createTestTeacher(ctx.db);
    const student = await createTestStudent(ctx.db, owner.id, { firstName: "מקורי" });

    await loginAs(intruder.id);
    const fd = formData({ firstName: "נחטף", lastName: student.lastName, phone: student.phone, email: "", credits: "0" });
    const result = await students.updateStudentAction(student.id, emptyState, fd);

    expect(result.error).toBeTruthy();
    const untouched = await ctx.db.student.findUnique({ where: { id: student.id } });
    expect(untouched?.firstName).toBe("מקורי");
  });

  it("rejects renaming a phone to one already used by another student of the same teacher", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    const studentA = await createTestStudent(ctx.db, teacher.id, { phone: "0501110001" });
    const studentB = await createTestStudent(ctx.db, teacher.id, { phone: "0501110002" });

    const fd = formData({ firstName: studentB.firstName, lastName: studentB.lastName, phone: studentA.phone, email: "", credits: "0" });
    const result = await students.updateStudentAction(studentB.id, emptyState, fd);

    expect(result.error).toBeTruthy();
  });

  it("allows a student to keep her own unchanged phone number when saving other edits", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    const student = await createTestStudent(ctx.db, teacher.id, { phone: "0501110003" });

    const fd = formData({ firstName: "שם חדש", lastName: student.lastName, phone: student.phone, email: "", credits: "0" });
    const result = await students.updateStudentAction(student.id, emptyState, fd);

    expect(result.error).toBeUndefined();
  });
});

describe("getStudentLessonHistoryAction", () => {
  it("returns registered/attended lessons from the last 3 months, newest first", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    const student = await createTestStudent(ctx.db, teacher.id);

    const older = await createTestLesson(ctx.db, teacher.id, { startsAt: daysAgo(10) });
    const newer = await createTestLesson(ctx.db, teacher.id, { startsAt: daysAgo(2) });
    await ctx.db.registration.create({
      data: { studentId: student.id, lessonId: older.id, status: "attended", creditDeducted: true },
    });
    await ctx.db.registration.create({
      data: { studentId: student.id, lessonId: newer.id, status: "registered", creditDeducted: true },
    });

    const result = await students.getStudentLessonHistoryAction(student.id);

    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(2);
    expect(result.entries?.[0].lesson.id).toBe(newer.id);
    expect(result.entries?.[1].lesson.id).toBe(older.id);
  });

  it("excludes cancelled and waitlisted registrations", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    const student = await createTestStudent(ctx.db, teacher.id);
    const lesson1 = await createTestLesson(ctx.db, teacher.id, { startsAt: daysAgo(2) });
    const lesson2 = await createTestLesson(ctx.db, teacher.id, { startsAt: daysAgo(3) });
    await ctx.db.registration.create({
      data: { studentId: student.id, lessonId: lesson1.id, status: "cancelled", creditDeducted: false },
    });
    await ctx.db.registration.create({
      data: { studentId: student.id, lessonId: lesson2.id, status: "waitlisted", creditDeducted: false },
    });

    const result = await students.getStudentLessonHistoryAction(student.id);

    expect(result.entries).toHaveLength(0);
  });

  it("excludes lessons older than 3 months", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    const student = await createTestStudent(ctx.db, teacher.id);
    const old = new Date();
    old.setMonth(old.getMonth() - 4);
    const lesson = await createTestLesson(ctx.db, teacher.id, { startsAt: old });
    await ctx.db.registration.create({
      data: { studentId: student.id, lessonId: lesson.id, status: "attended", creditDeducted: true },
    });

    const result = await students.getStudentLessonHistoryAction(student.id);

    expect(result.entries).toHaveLength(0);
  });

  it("does not allow a teacher to view another teacher's student history", async () => {
    const { teacher: owner } = await createTestTeacher(ctx.db);
    const { teacher: intruder } = await createTestTeacher(ctx.db);
    const student = await createTestStudent(ctx.db, owner.id);

    await loginAs(intruder.id);
    const result = await students.getStudentLessonHistoryAction(student.id);

    expect(result.error).toBeTruthy();
  });
});
