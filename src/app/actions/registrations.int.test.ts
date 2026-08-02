import { beforeAll, describe, expect, it, vi } from "vitest";
import "@/test/nextMocks";
import { NextRedirectSignal } from "@/test/nextMocks";
import { setupActionTestDb, fakeCookies } from "@/test/actionTestContext";
import { createTestLesson, createTestStudent, createTestTeacher } from "@/test/factories";
import type { RegisterActionState } from "./registrations";
import type { IdentifyActionState } from "./identify";

// sendLessonReminderAction (tested below) calls into the real Baileys
// session layer - none of that belongs in a test, so it's mocked file-wide.
// Every other test in this file never touches it, so this has no effect on
// them beyond skipping the real module load.
const sendWhatsappMessageMock = vi.fn();
vi.mock("@/lib/whatsapp", () => ({
  sendWhatsappMessage: (...args: unknown[]) => sendWhatsappMessageMock(...args),
}));

function registrationFormData(
  allLessonIds: string[],
  checkedLessonIds: string[],
  actingStudentId?: string
): FormData {
  const fd = new FormData();
  for (const id of allLessonIds) fd.append("allLessonIds", id);
  for (const id of checkedLessonIds) fd.append("lessonIds", id);
  if (actingStudentId) fd.set("actingStudentId", actingStudentId);
  return fd;
}

function identifyFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const ctx = setupActionTestDb();
let registrations: typeof import("./registrations");
let identify: typeof import("./identify");
let publish: typeof import("./publish");
let session: typeof import("@/lib/session");
let studentAuth: typeof import("@/lib/studentAuth");

beforeAll(async () => {
  registrations = await import("./registrations");
  identify = await import("./identify");
  publish = await import("./publish");
  session = await import("@/lib/session");
  studentAuth = await import("@/lib/studentAuth");
});

async function loginAsTeacher(teacherId: string) {
  await session.createSession(teacherId);
}

async function loginAsStudent(teacherId: string, studentId: string) {
  await studentAuth.createStudentSession(teacherId, studentId);
}

const emptyRegisterState: RegisterActionState = {};
const emptyIdentifyState: IdentifyActionState = {};

describe("updateRegistrationsAction — credit deduction and capacity", () => {
  it("deducts exactly one credit when registering for an open lesson", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const student = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    const lesson = await createTestLesson(ctx.db, teacher.id, { capacity: 10 });
    await loginAsStudent(teacher.id, student.id);

    const result = await registrations.updateRegistrationsAction(
      teacher.id,
      emptyRegisterState,
      registrationFormData([lesson.id], [lesson.id])
    );

    expect(result.results?.[0].status).toBe("registered");
    expect(result.remainingCredits).toBe(4);
    const reg = await ctx.db.registration.findUnique({ where: { studentId_lessonId: { studentId: student.id, lessonId: lesson.id } } });
    expect(reg?.status).toBe("registered");
    expect(reg?.creditDeducted).toBe(true);
  });

  it("does not deduct a credit while waitlisted", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const fullLesson = await createTestLesson(ctx.db, teacher.id, { capacity: 1 });
    const existingStudent = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    await ctx.db.registration.create({
      data: { studentId: existingStudent.id, lessonId: fullLesson.id, status: "registered", creditDeducted: true },
    });

    const student = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    await loginAsStudent(teacher.id, student.id);

    const result = await registrations.updateRegistrationsAction(
      teacher.id,
      emptyRegisterState,
      registrationFormData([fullLesson.id], [fullLesson.id])
    );

    expect(result.results?.[0].status).toBe("waitlisted");
    expect(result.remainingCredits).toBe(5);
    const reg = await ctx.db.registration.findUnique({ where: { studentId_lessonId: { studentId: student.id, lessonId: fullLesson.id } } });
    expect(reg?.status).toBe("waitlisted");
    expect(reg?.creditDeducted).toBe(false);
  });

  it("never blocks registration when the student has zero credits", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const student = await createTestStudent(ctx.db, teacher.id, { credits: 0 });
    const lesson = await createTestLesson(ctx.db, teacher.id, { capacity: 10 });
    await loginAsStudent(teacher.id, student.id);

    const result = await registrations.updateRegistrationsAction(
      teacher.id,
      emptyRegisterState,
      registrationFormData([lesson.id], [lesson.id])
    );

    expect(result.results?.[0].status).toBe("registered");
    expect(result.remainingCredits).toBe(-1);
    expect(result.ranOutOfCredits).toBe(true);
  });

  it("never blocks registration when the student already has negative credits", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const student = await createTestStudent(ctx.db, teacher.id, { credits: -3 });
    const lesson = await createTestLesson(ctx.db, teacher.id, { capacity: 10 });
    await loginAsStudent(teacher.id, student.id);

    const result = await registrations.updateRegistrationsAction(
      teacher.id,
      emptyRegisterState,
      registrationFormData([lesson.id], [lesson.id])
    );

    expect(result.results?.[0].status).toBe("registered");
    expect(result.remainingCredits).toBe(-4);
  });

  it("waitlists once capacity is reached, even across two different students in sequence", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const lesson = await createTestLesson(ctx.db, teacher.id, { capacity: 1 });

    const first = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    await loginAsStudent(teacher.id, first.id);
    const firstResult = await registrations.updateRegistrationsAction(
      teacher.id,
      emptyRegisterState,
      registrationFormData([lesson.id], [lesson.id])
    );
    expect(firstResult.results?.[0].status).toBe("registered");

    const second = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    await loginAsStudent(teacher.id, second.id);
    const secondResult = await registrations.updateRegistrationsAction(
      teacher.id,
      emptyRegisterState,
      registrationFormData([lesson.id], [lesson.id])
    );
    expect(secondResult.results?.[0].status).toBe("waitlisted");
  });
});

describe("updateRegistrationsAction — cancellation", () => {
  it("refunds a deducted credit when cancelling a registered (non-waitlisted) lesson", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const student = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    const lesson = await createTestLesson(ctx.db, teacher.id, { capacity: 10 });
    await loginAsStudent(teacher.id, student.id);
    await registrations.updateRegistrationsAction(teacher.id, emptyRegisterState, registrationFormData([lesson.id], [lesson.id]));

    const result = await registrations.updateRegistrationsAction(teacher.id, emptyRegisterState, registrationFormData([lesson.id], []));

    expect(result.results?.[0].status).toBe("cancelled");
    expect(result.remainingCredits).toBe(5);
  });

  it("does not refund anything when cancelling a waitlisted (never-deducted) registration", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const fullLesson = await createTestLesson(ctx.db, teacher.id, { capacity: 1 });
    const other = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    await ctx.db.registration.create({ data: { studentId: other.id, lessonId: fullLesson.id, status: "registered", creditDeducted: true } });

    const student = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    await loginAsStudent(teacher.id, student.id);
    await registrations.updateRegistrationsAction(teacher.id, emptyRegisterState, registrationFormData([fullLesson.id], [fullLesson.id]));

    const result = await registrations.updateRegistrationsAction(teacher.id, emptyRegisterState, registrationFormData([fullLesson.id], []));

    expect(result.results?.[0].status).toBe("cancelled");
    expect(result.remainingCredits).toBe(5);
  });

  it("GAP (see qa-test-plan.md): cancellation succeeds even after the lesson has already started — no cutoff is enforced", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const student = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    const pastLesson = await createTestLesson(ctx.db, teacher.id, {
      startsAt: new Date(Date.now() - 60 * 60 * 1000),
      capacity: 10,
    });
    await ctx.db.registration.create({ data: { studentId: student.id, lessonId: pastLesson.id, status: "registered", creditDeducted: true } });
    await loginAsStudent(teacher.id, student.id);

    const result = await registrations.updateRegistrationsAction(teacher.id, emptyRegisterState, registrationFormData([pastLesson.id], []));

    expect(result.results?.[0].status).toBe("cancelled");
  });

  it("GAP (see qa-test-plan.md): the next waitlisted student is NOT auto-promoted when a registered student cancels", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const lesson = await createTestLesson(ctx.db, teacher.id, { capacity: 1 });
    const registered = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    const waitlisted = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    await ctx.db.registration.create({ data: { studentId: registered.id, lessonId: lesson.id, status: "registered", creditDeducted: true } });
    await ctx.db.registration.create({ data: { studentId: waitlisted.id, lessonId: lesson.id, status: "waitlisted", creditDeducted: false } });

    await loginAsStudent(teacher.id, registered.id);
    await registrations.updateRegistrationsAction(teacher.id, emptyRegisterState, registrationFormData([lesson.id], []));

    const waitlistedReg = await ctx.db.registration.findUnique({
      where: { studentId_lessonId: { studentId: waitlisted.id, lessonId: lesson.id } },
    });
    expect(waitlistedReg?.status).toBe("waitlisted");
    expect(waitlistedReg?.creditDeducted).toBe(false);
    const waitlistedStudent = await ctx.db.student.findUnique({ where: { id: waitlisted.id } });
    expect(waitlistedStudent?.credits).toBe(5);
  });
});

describe("updateRegistrationsAction — multi-tenant isolation", () => {
  it("silently ignores a lesson id that belongs to a different teacher", async () => {
    const { teacher: teacherA } = await createTestTeacher(ctx.db);
    const { teacher: teacherB } = await createTestTeacher(ctx.db);
    const foreignLesson = await createTestLesson(ctx.db, teacherB.id, { capacity: 10 });
    const student = await createTestStudent(ctx.db, teacherA.id, { credits: 5 });
    await loginAsStudent(teacherA.id, student.id);

    const result = await registrations.updateRegistrationsAction(
      teacherA.id,
      emptyRegisterState,
      registrationFormData([foreignLesson.id], [foreignLesson.id])
    );

    expect(result.results).toHaveLength(0);
    const reg = await ctx.db.registration.findUnique({
      where: { studentId_lessonId: { studentId: student.id, lessonId: foreignLesson.id } },
    });
    expect(reg).toBeNull();
  });

  it("returns an error when no student is identified for this teacher", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const lesson = await createTestLesson(ctx.db, teacher.id);
    fakeCookies.clear();

    const result = await registrations.updateRegistrationsAction(teacher.id, emptyRegisterState, registrationFormData([lesson.id], [lesson.id]));

    expect(result.error).toBeTruthy();
  });
});

describe("updateRegistrationsAction — registering on behalf of a linked student", () => {
  it("registers and deducts credit for the dependent, not the identified registrar", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const registrar = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    const dependent = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    await ctx.db.studentLink.create({ data: { registrarId: registrar.id, dependentId: dependent.id } });
    const lesson = await createTestLesson(ctx.db, teacher.id, { capacity: 10 });
    await loginAsStudent(teacher.id, registrar.id);

    const result = await registrations.updateRegistrationsAction(
      teacher.id,
      emptyRegisterState,
      registrationFormData([lesson.id], [lesson.id], dependent.id)
    );

    expect(result.results?.[0].status).toBe("registered");
    expect(result.remainingCredits).toBe(4);
    const dependentReg = await ctx.db.registration.findUnique({
      where: { studentId_lessonId: { studentId: dependent.id, lessonId: lesson.id } },
    });
    expect(dependentReg?.status).toBe("registered");
    const untouchedRegistrar = await ctx.db.student.findUnique({ where: { id: registrar.id } });
    expect(untouchedRegistrar?.credits).toBe(5);
  });

  it("rejects acting on behalf of a student with no link to the identified registrar", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const registrar = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    const stranger = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    const lesson = await createTestLesson(ctx.db, teacher.id, { capacity: 10 });
    await loginAsStudent(teacher.id, registrar.id);

    const result = await registrations.updateRegistrationsAction(
      teacher.id,
      emptyRegisterState,
      registrationFormData([lesson.id], [lesson.id], stranger.id)
    );

    expect(result.error).toBeTruthy();
    const reg = await ctx.db.registration.findUnique({
      where: { studentId_lessonId: { studentId: stranger.id, lessonId: lesson.id } },
    });
    expect(reg).toBeNull();
  });
});

describe("teacherCancelRegistrationAction", () => {
  it("cancels a registration and refunds a deducted credit", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const student = await createTestStudent(ctx.db, teacher.id, { credits: 3 });
    const lesson = await createTestLesson(ctx.db, teacher.id, { capacity: 10 });
    const reg = await ctx.db.registration.create({
      data: { studentId: student.id, lessonId: lesson.id, status: "registered", creditDeducted: true },
    });
    await loginAsTeacher(teacher.id);

    const result = await registrations.teacherCancelRegistrationAction(reg.id);

    expect(result.error).toBeUndefined();
    const updatedReg = await ctx.db.registration.findUnique({ where: { id: reg.id } });
    expect(updatedReg?.status).toBe("cancelled");
    const updatedStudent = await ctx.db.student.findUnique({ where: { id: student.id } });
    expect(updatedStudent?.credits).toBe(4);
  });

  it("does not refund when the registration never had a credit deducted (e.g. a waitlist entry)", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const student = await createTestStudent(ctx.db, teacher.id, { credits: 3 });
    const lesson = await createTestLesson(ctx.db, teacher.id, { capacity: 10 });
    const reg = await ctx.db.registration.create({
      data: { studentId: student.id, lessonId: lesson.id, status: "waitlisted", creditDeducted: false },
    });
    await loginAsTeacher(teacher.id);

    await registrations.teacherCancelRegistrationAction(reg.id);

    const updatedStudent = await ctx.db.student.findUnique({ where: { id: student.id } });
    expect(updatedStudent?.credits).toBe(3);
  });

  it("does not allow a teacher to cancel a registration belonging to another teacher's lesson", async () => {
    const { teacher: owner } = await createTestTeacher(ctx.db);
    const { teacher: intruder } = await createTestTeacher(ctx.db);
    const student = await createTestStudent(ctx.db, owner.id, { credits: 3 });
    const lesson = await createTestLesson(ctx.db, owner.id);
    const reg = await ctx.db.registration.create({
      data: { studentId: student.id, lessonId: lesson.id, status: "registered", creditDeducted: true },
    });
    await loginAsTeacher(intruder.id);

    const result = await registrations.teacherCancelRegistrationAction(reg.id);

    expect(result.error).toBeTruthy();
    const untouched = await ctx.db.registration.findUnique({ where: { id: reg.id } });
    expect(untouched?.status).toBe("registered");
  });
});

describe("manualRegisterStudentAction", () => {
  it("registers a student and deducts a credit, same as self-registration", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const student = await createTestStudent(ctx.db, teacher.id, { credits: 4 });
    const lesson = await createTestLesson(ctx.db, teacher.id, { capacity: 10 });
    await loginAsTeacher(teacher.id);

    const result = await registrations.manualRegisterStudentAction(lesson.id, student.id);

    expect(result.error).toBeUndefined();
    const reg = await ctx.db.registration.findUnique({ where: { studentId_lessonId: { studentId: student.id, lessonId: lesson.id } } });
    expect(reg?.status).toBe("registered");
    const updatedStudent = await ctx.db.student.findUnique({ where: { id: student.id } });
    expect(updatedStudent?.credits).toBe(3);
  });

  it("blocks manually registering a student once the lesson is at capacity", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const lesson = await createTestLesson(ctx.db, teacher.id, { capacity: 1 });
    const alreadyIn = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    await ctx.db.registration.create({ data: { studentId: alreadyIn.id, lessonId: lesson.id, status: "registered", creditDeducted: true } });
    const newStudent = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    await loginAsTeacher(teacher.id);

    const result = await registrations.manualRegisterStudentAction(lesson.id, newStudent.id);

    expect(result.error).toBeTruthy();
    const reg = await ctx.db.registration.findUnique({ where: { studentId_lessonId: { studentId: newStudent.id, lessonId: lesson.id } } });
    expect(reg).toBeNull();
    const untouchedStudent = await ctx.db.student.findUnique({ where: { id: newStudent.id } });
    expect(untouchedStudent?.credits).toBe(5);
  });

  it("rejects registering a student who is already actively registered", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const lesson = await createTestLesson(ctx.db, teacher.id, { capacity: 10 });
    const student = await createTestStudent(ctx.db, teacher.id, { credits: 5 });
    await ctx.db.registration.create({ data: { studentId: student.id, lessonId: lesson.id, status: "registered", creditDeducted: true } });
    await loginAsTeacher(teacher.id);

    const result = await registrations.manualRegisterStudentAction(lesson.id, student.id);

    expect(result.error).toBeTruthy();
  });

  it("does not allow registering a student into another teacher's lesson", async () => {
    const { teacher: owner } = await createTestTeacher(ctx.db);
    const { teacher: intruder } = await createTestTeacher(ctx.db);
    const lesson = await createTestLesson(ctx.db, owner.id, { capacity: 10 });
    const student = await createTestStudent(ctx.db, intruder.id, { credits: 5 });
    await loginAsTeacher(intruder.id);

    const result = await registrations.manualRegisterStudentAction(lesson.id, student.id);

    expect(result.error).toBeTruthy();
  });

  it("does not allow registering another teacher's student", async () => {
    const { teacher: owner } = await createTestTeacher(ctx.db);
    const { teacher: intruder } = await createTestTeacher(ctx.db);
    const lesson = await createTestLesson(ctx.db, owner.id, { capacity: 10 });
    const foreignStudent = await createTestStudent(ctx.db, intruder.id, { credits: 5 });
    await loginAsTeacher(owner.id);

    const result = await registrations.manualRegisterStudentAction(lesson.id, foreignStudent.id);

    expect(result.error).toBeTruthy();
  });
});

describe("identifyStudentAction", () => {
  it("creates a new student record on first identification and splits the name", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const fd = identifyFormData({ name: "דנה לוי", phone: "0501234567" });

    await expect(
      identify.identifyStudentAction(teacher.id, `/plan/${teacher.id}`, emptyIdentifyState, fd)
    ).rejects.toBeInstanceOf(NextRedirectSignal);

    const created = await ctx.db.student.findUnique({ where: { teacherId_phone: { teacherId: teacher.id, phone: "0501234567" } } });
    expect(created?.firstName).toBe("דנה");
    expect(created?.lastName).toBe("לוי");
  });

  it("recognizes a returning student by exact phone match instead of creating a duplicate", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const existing = await createTestStudent(ctx.db, teacher.id, { phone: "0509998888", firstName: "קיימת" });
    const fd = identifyFormData({ name: "שם אחר לגמרי", phone: "0509998888" });

    await expect(
      identify.identifyStudentAction(teacher.id, `/plan/${teacher.id}`, emptyIdentifyState, fd)
    ).rejects.toBeInstanceOf(NextRedirectSignal);

    const count = await ctx.db.student.count({ where: { teacherId: teacher.id, phone: "0509998888" } });
    expect(count).toBe(1);
    const unchanged = await ctx.db.student.findUnique({ where: { id: existing.id } });
    expect(unchanged?.firstName).toBe("קיימת");
  });

  it("rejects an empty name", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const fd = identifyFormData({ name: "", phone: "0501234567" });

    const result = await identify.identifyStudentAction(teacher.id, `/plan/${teacher.id}`, emptyIdentifyState, fd);

    expect(result.error).toBeTruthy();
  });

  it("rejects a malformed phone number (fixed — previously an undocumented gap)", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const fd = identifyFormData({ name: "מישהי", phone: "not-a-real-phone" });

    const result = await identify.identifyStudentAction(teacher.id, `/plan/${teacher.id}`, emptyIdentifyState, fd);

    expect(result.error).toBeTruthy();
    const count = await ctx.db.student.count({ where: { teacherId: teacher.id } });
    expect(count).toBe(0);
  });

  it("normalizes a phone number with formatting characters before matching/storing it", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const fd = identifyFormData({ name: "מישהי", phone: "050-111-2222" });

    await expect(
      identify.identifyStudentAction(teacher.id, `/plan/${teacher.id}`, emptyIdentifyState, fd)
    ).rejects.toBeInstanceOf(NextRedirectSignal);

    const created = await ctx.db.student.findUnique({
      where: { teacherId_phone: { teacherId: teacher.id, phone: "0501112222" } },
    });
    expect(created).not.toBeNull();
  });

  it("falls back to the plan page instead of following an off-site open-redirect returnTo", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const fd = identifyFormData({ name: "מישהי", phone: "0507778888" });

    let caught: unknown;
    try {
      await identify.identifyStudentAction(teacher.id, "https://evil.example.com", emptyIdentifyState, fd);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(NextRedirectSignal);
    expect((caught as InstanceType<typeof NextRedirectSignal>).url).toBe(`/plan/${teacher.id}`);
  });

  it("blocks further identify attempts from the same IP once the threshold is exceeded", async () => {
    const { teacher } = await createTestTeacher(ctx.db);

    for (let i = 0; i < 10; i++) {
      const fd = identifyFormData({ name: "מישהי", phone: `05012340${String(i).padStart(2, "0")}` });
      await expect(
        identify.identifyStudentAction(teacher.id, `/plan/${teacher.id}`, emptyIdentifyState, fd)
      ).rejects.toBeInstanceOf(NextRedirectSignal);
    }

    const fd = identifyFormData({ name: "מישהי", phone: "0509990000" });
    const result = await identify.identifyStudentAction(teacher.id, `/plan/${teacher.id}`, emptyIdentifyState, fd);

    expect(result.error).toBeTruthy();
    const created = await ctx.db.student.findUnique({
      where: { teacherId_phone: { teacherId: teacher.id, phone: "0509990000" } },
    });
    expect(created).toBeNull();
  });
});

describe("publishWeekAction", () => {
  it("blocks publishing a week with no lessons", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAsTeacher(teacher.id);

    const result = await publish.publishWeekAction("2027-01-03");

    expect(result.error).toBeTruthy();
  });

  it("publishes a week that has at least one lesson", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAsTeacher(teacher.id);
    const { getWeekRangeFromStartParam } = await import("@/lib/week");
    const range = getWeekRangeFromStartParam("2027-02-07")!;
    await createTestLesson(ctx.db, teacher.id, { startsAt: new Date(range.start.getTime() + 24 * 60 * 60 * 1000) });

    const result = await publish.publishWeekAction("2027-02-07");

    expect(result.error).toBeUndefined();
    const publication = await ctx.db.weeklyPlanPublication.findUnique({
      where: { teacherId_weekStart: { teacherId: teacher.id, weekStart: range.start } },
    });
    expect(publication).not.toBeNull();
  });

  it("is idempotent — publishing the same week twice does not error or duplicate", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAsTeacher(teacher.id);
    const { getWeekRangeFromStartParam } = await import("@/lib/week");
    const range = getWeekRangeFromStartParam("2027-03-07")!;
    await createTestLesson(ctx.db, teacher.id, { startsAt: new Date(range.start.getTime() + 24 * 60 * 60 * 1000) });

    await publish.publishWeekAction("2027-03-07");
    const second = await publish.publishWeekAction("2027-03-07");

    expect(second.error).toBeUndefined();
    const count = await ctx.db.weeklyPlanPublication.count({
      where: { teacherId: teacher.id, weekStart: range.start },
    });
    expect(count).toBe(1);
  });
});

describe("sendLessonReminderAction", () => {
  it("requires an active teacher session", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const lesson = await createTestLesson(ctx.db, teacher.id);

    await expect(registrations.sendLessonReminderAction(lesson.id)).rejects.toBeInstanceOf(NextRedirectSignal);
  });

  it("returns an error for a nonexistent lesson", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAsTeacher(teacher.id);

    const result = await registrations.sendLessonReminderAction("nonexistent-id");

    expect(result.error).toBeTruthy();
  });

  it("does not allow sending a reminder for another teacher's lesson", async () => {
    const { teacher: owner } = await createTestTeacher(ctx.db);
    const { teacher: intruder } = await createTestTeacher(ctx.db);
    const lesson = await createTestLesson(ctx.db, owner.id);
    await loginAsTeacher(intruder.id);

    const result = await registrations.sendLessonReminderAction(lesson.id);

    expect(result.error).toBeTruthy();
    expect(sendWhatsappMessageMock).not.toHaveBeenCalled();
  });

  it("returns an error when whatsapp isn't connected, without attempting any sends", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    const lesson = await createTestLesson(ctx.db, teacher.id);
    const student = await createTestStudent(ctx.db, teacher.id);
    await ctx.db.registration.create({
      data: { studentId: student.id, lessonId: lesson.id, status: "registered", creditDeducted: true },
    });
    await loginAsTeacher(teacher.id);

    const result = await registrations.sendLessonReminderAction(lesson.id);

    expect(result.error).toBeTruthy();
    expect(sendWhatsappMessageMock).not.toHaveBeenCalled();
  });

  it("returns an error when no students are registered", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await ctx.db.teacher.update({ where: { id: teacher.id }, data: { whatsappConnected: true } });
    const lesson = await createTestLesson(ctx.db, teacher.id);
    await loginAsTeacher(teacher.id);

    const result = await registrations.sendLessonReminderAction(lesson.id);

    expect(result.error).toBeTruthy();
    expect(sendWhatsappMessageMock).not.toHaveBeenCalled();
  });

  it("sends the meeting-time message to every registered student and reports the count", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await ctx.db.teacher.update({ where: { id: teacher.id }, data: { whatsappConnected: true } });
    // Winter (IST, UTC+2): 14:00 UTC -> 16:00 Israel local time.
    const lesson = await createTestLesson(ctx.db, teacher.id, { startsAt: new Date("2027-01-15T14:00:00.000Z") });
    const studentA = await createTestStudent(ctx.db, teacher.id, { phone: "0501110001" });
    const studentB = await createTestStudent(ctx.db, teacher.id, { phone: "0501110002" });
    await ctx.db.registration.create({
      data: { studentId: studentA.id, lessonId: lesson.id, status: "registered", creditDeducted: true },
    });
    await ctx.db.registration.create({
      data: { studentId: studentB.id, lessonId: lesson.id, status: "registered", creditDeducted: true },
    });
    sendWhatsappMessageMock.mockResolvedValue(undefined);
    await loginAsTeacher(teacher.id);

    // The action sleeps briefly between sends as an anti-detection
    // precaution - fake timers avoid actually waiting on that in tests.
    vi.useFakeTimers();
    let result;
    try {
      const resultPromise = registrations.sendLessonReminderAction(lesson.id);
      await vi.runAllTimersAsync();
      result = await resultPromise;
    } finally {
      vi.useRealTimers();
    }

    expect(result.error).toBeUndefined();
    expect(result.sentCount).toBe(2);
    expect(result.failedNames).toBeUndefined();
    expect(sendWhatsappMessageMock).toHaveBeenCalledWith(teacher.id, "0501110001", "ניפגש היום ב-16:00");
    expect(sendWhatsappMessageMock).toHaveBeenCalledWith(teacher.id, "0501110002", "ניפגש היום ב-16:00");
  });

  it("excludes waitlisted and cancelled registrations from the send", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await ctx.db.teacher.update({ where: { id: teacher.id }, data: { whatsappConnected: true } });
    const lesson = await createTestLesson(ctx.db, teacher.id);
    const registered = await createTestStudent(ctx.db, teacher.id);
    const waitlisted = await createTestStudent(ctx.db, teacher.id);
    const cancelled = await createTestStudent(ctx.db, teacher.id);
    await ctx.db.registration.create({
      data: { studentId: registered.id, lessonId: lesson.id, status: "registered", creditDeducted: true },
    });
    await ctx.db.registration.create({
      data: { studentId: waitlisted.id, lessonId: lesson.id, status: "waitlisted", creditDeducted: false },
    });
    await ctx.db.registration.create({
      data: { studentId: cancelled.id, lessonId: lesson.id, status: "cancelled", creditDeducted: false },
    });
    sendWhatsappMessageMock.mockResolvedValue(undefined);
    await loginAsTeacher(teacher.id);

    vi.useFakeTimers();
    let result;
    try {
      const resultPromise = registrations.sendLessonReminderAction(lesson.id);
      await vi.runAllTimersAsync();
      result = await resultPromise;
    } finally {
      vi.useRealTimers();
    }

    expect(result.sentCount).toBe(1);
    expect(sendWhatsappMessageMock).toHaveBeenCalledTimes(1);
    expect(sendWhatsappMessageMock).toHaveBeenCalledWith(teacher.id, registered.phone, expect.any(String));
  });

  it("reports a per-student failure by name without failing the whole batch", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await ctx.db.teacher.update({ where: { id: teacher.id }, data: { whatsappConnected: true } });
    const lesson = await createTestLesson(ctx.db, teacher.id);
    const okStudent = await createTestStudent(ctx.db, teacher.id, { firstName: "תקינה", lastName: "בדיקה" });
    const failingStudent = await createTestStudent(ctx.db, teacher.id, { firstName: "נכשלת", lastName: "בדיקה" });
    await ctx.db.registration.create({
      data: { studentId: okStudent.id, lessonId: lesson.id, status: "registered", creditDeducted: true },
    });
    await ctx.db.registration.create({
      data: { studentId: failingStudent.id, lessonId: lesson.id, status: "registered", creditDeducted: true },
    });
    sendWhatsappMessageMock.mockImplementation(async (_teacherId: string, phone: string) => {
      if (phone === failingStudent.phone) throw new Error("send failed");
    });
    await loginAsTeacher(teacher.id);

    vi.useFakeTimers();
    let result;
    try {
      const resultPromise = registrations.sendLessonReminderAction(lesson.id);
      await vi.runAllTimersAsync();
      result = await resultPromise;
    } finally {
      vi.useRealTimers();
    }

    expect(result.sentCount).toBe(1);
    expect(result.failedNames).toEqual(["נכשלת בדיקה"]);
  });
});
