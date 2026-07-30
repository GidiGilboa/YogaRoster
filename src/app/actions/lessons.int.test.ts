import { beforeAll, describe, expect, it } from "vitest";
import "@/test/nextMocks";
import { setupActionTestDb } from "@/test/actionTestContext";
import { createTestLesson, createTestTeacher } from "@/test/factories";
import { getWeekRange } from "@/lib/week";
import type { LessonActionState } from "./lessons";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const ctx = setupActionTestDb();
let lessons: typeof import("./lessons");
let session: typeof import("@/lib/session");

beforeAll(async () => {
  lessons = await import("./lessons");
  session = await import("@/lib/session");
});

async function loginAs(teacherId: string) {
  await session.createSession(teacherId);
}

function futureDate(daysAhead = 3): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d;
}

const emptyState: LessonActionState = {};

describe("createLessonAction", () => {
  it("creates a lesson with valid input", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const fd = formData({
      startsAt: futureDate().toISOString(),
      duration: "60",
      capacity: "12",
      comment: "מזרן משלכם",
    });

    const result = await lessons.createLessonAction(emptyState, fd);

    expect(result.error).toBeUndefined();
    const created = await ctx.db.lesson.findFirst({ where: { teacherId: teacher.id } });
    expect(created).not.toBeNull();
    expect(created?.capacity).toBe(12);
    expect(created?.comment).toBe("מזרן משלכם");
  });

  it("rejects a non-positive capacity", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const fd = formData({ startsAt: futureDate().toISOString(), duration: "60", capacity: "0" });
    const result = await lessons.createLessonAction(emptyState, fd);

    expect(result.error).toBeTruthy();
  });

  it("rejects a non-positive duration", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const fd = formData({ startsAt: futureDate().toISOString(), duration: "0", capacity: "10" });
    const result = await lessons.createLessonAction(emptyState, fd);

    expect(result.error).toBeTruthy();
  });

  it("rejects an invalid date/time", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const fd = formData({ startsAt: "not-a-date", duration: "60", capacity: "10" });
    const result = await lessons.createLessonAction(emptyState, fd);

    expect(result.error).toBeTruthy();
  });

  it("blocks creating a lesson in the past (undocumented rule — see qa-test-plan.md)", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const past = new Date();
    past.setDate(past.getDate() - 1);
    const fd = formData({ startsAt: past.toISOString(), duration: "60", capacity: "10" });

    const result = await lessons.createLessonAction(emptyState, fd);

    expect(result.error).toBeTruthy();
    const count = await ctx.db.lesson.count({ where: { teacherId: teacher.id } });
    expect(count).toBe(0);
  });
});

describe("updateLessonAction", () => {
  it("updates an existing lesson's fields", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    const lesson = await createTestLesson(ctx.db, teacher.id, { capacity: 5 });

    const fd = formData({
      startsAt: futureDate(5).toISOString(),
      duration: "45",
      capacity: "8",
    });
    const result = await lessons.updateLessonAction(lesson.id, emptyState, fd);

    expect(result.error).toBeUndefined();
    const updated = await ctx.db.lesson.findUnique({ where: { id: lesson.id } });
    expect(updated?.capacity).toBe(8);
    expect(updated?.durationMinutes).toBe(45);
  });

  it("does not allow a teacher to edit another teacher's lesson (multi-tenant isolation)", async () => {
    const { teacher: owner } = await createTestTeacher(ctx.db);
    const { teacher: intruder } = await createTestTeacher(ctx.db);
    const lesson = await createTestLesson(ctx.db, owner.id, { capacity: 9 });

    await loginAs(intruder.id);
    const fd = formData({ startsAt: futureDate().toISOString(), duration: "60", capacity: "2" });
    const result = await lessons.updateLessonAction(lesson.id, emptyState, fd);

    expect(result.error).toBeTruthy();
    const untouched = await ctx.db.lesson.findUnique({ where: { id: lesson.id } });
    expect(untouched?.capacity).toBe(9);
  });

  it("rejects invalid input on update", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    const lesson = await createTestLesson(ctx.db, teacher.id);

    const fd = formData({ startsAt: futureDate().toISOString(), duration: "60", capacity: "0" });
    const result = await lessons.updateLessonAction(lesson.id, emptyState, fd);

    expect(result.error).toBeTruthy();
  });
});

describe("deleteLessonAction", () => {
  it("deletes a lesson the teacher owns", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    const lesson = await createTestLesson(ctx.db, teacher.id);

    const result = await lessons.deleteLessonAction(lesson.id);

    expect(result.error).toBeUndefined();
    expect(await ctx.db.lesson.findUnique({ where: { id: lesson.id } })).toBeNull();
  });

  it("does not allow a teacher to delete another teacher's lesson", async () => {
    const { teacher: owner } = await createTestTeacher(ctx.db);
    const { teacher: intruder } = await createTestTeacher(ctx.db);
    const lesson = await createTestLesson(ctx.db, owner.id);

    await loginAs(intruder.id);
    const result = await lessons.deleteLessonAction(lesson.id);

    expect(result.error).toBeTruthy();
    expect(await ctx.db.lesson.findUnique({ where: { id: lesson.id } })).not.toBeNull();
  });

  it("throws on deleting a lesson with an active registration instead of a friendly error (gap — see qa-test-plan.md)", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    const lesson = await createTestLesson(ctx.db, teacher.id, { capacity: 5 });
    const { createTestStudent } = await import("@/test/factories");
    const student = await createTestStudent(ctx.db, teacher.id);
    await ctx.db.registration.create({
      data: { studentId: student.id, lessonId: lesson.id, status: "registered", creditDeducted: true },
    });

    // Documents current (unhandled) behavior: the DB's ON DELETE RESTRICT
    // foreign key rejects the delete and the action has no try/catch around
    // it, so the raw Prisma error propagates instead of a user-facing
    // message. This is flagged as a gap in qa-test-plan.md, not a spec.
    await expect(lessons.deleteLessonAction(lesson.id)).rejects.toThrow();
    expect(await ctx.db.lesson.findUnique({ where: { id: lesson.id } })).not.toBeNull();
  });
});

describe("copyPreviousWeekAction", () => {
  it("duplicates last week's lessons into the target week, shifted by 7 days", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const thisWeek = getWeekRange(10); // far enough ahead to be uncontaminated by other tests
    const original = await createTestLesson(ctx.db, teacher.id, {
      startsAt: new Date(thisWeek.start.getTime() + 24 * 60 * 60 * 1000),
      capacity: 7,
    });

    const result = await lessons.copyPreviousWeekAction(11);

    expect(result.status).toBe("success");
    const nextWeek = getWeekRange(11);
    const copied = await ctx.db.lesson.findMany({
      where: { teacherId: teacher.id, startsAt: { gte: nextWeek.start, lt: nextWeek.end } },
    });
    expect(copied).toHaveLength(1);
    expect(copied[0].capacity).toBe(7);
    expect(copied[0].startsAt.getTime()).toBe(original.startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  });

  it("returns an empty status when there is nothing to copy", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const result = await lessons.copyPreviousWeekAction(30);

    expect(result.status).toBe("empty");
  });

  it("returns a past status when the target week has already ended", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);

    const result = await lessons.copyPreviousWeekAction(-20);

    expect(result.status).toBe("past");
  });
});
