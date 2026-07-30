import { beforeAll, describe, expect, it } from "vitest";
import "@/test/nextMocks";
import { setupActionTestDb } from "@/test/actionTestContext";
import { createTestStudent, createTestTeacher } from "@/test/factories";

const ctx = setupActionTestDb();
let studentLinks: typeof import("./studentLinks");
let session: typeof import("@/lib/session");

beforeAll(async () => {
  studentLinks = await import("./studentLinks");
  session = await import("@/lib/session");
});

async function loginAs(teacherId: string) {
  await session.createSession(teacherId);
}

describe("addStudentLinkAction", () => {
  it("links a dependent to a registrar student", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    const registrar = await createTestStudent(ctx.db, teacher.id);
    const dependent = await createTestStudent(ctx.db, teacher.id);

    const result = await studentLinks.addStudentLinkAction(registrar.id, dependent.id);

    expect(result.error).toBeUndefined();
    const link = await ctx.db.studentLink.findUnique({
      where: { registrarId_dependentId: { registrarId: registrar.id, dependentId: dependent.id } },
    });
    expect(link).not.toBeNull();
  });

  it("rejects linking a student to herself", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    const student = await createTestStudent(ctx.db, teacher.id);

    const result = await studentLinks.addStudentLinkAction(student.id, student.id);

    expect(result.error).toBeTruthy();
  });

  it("rejects a duplicate link", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    const registrar = await createTestStudent(ctx.db, teacher.id);
    const dependent = await createTestStudent(ctx.db, teacher.id);
    await studentLinks.addStudentLinkAction(registrar.id, dependent.id);

    const result = await studentLinks.addStudentLinkAction(registrar.id, dependent.id);

    expect(result.error).toBeTruthy();
    const count = await ctx.db.studentLink.count({ where: { registrarId: registrar.id, dependentId: dependent.id } });
    expect(count).toBe(1);
  });

  it("does not allow linking students belonging to another teacher", async () => {
    const { teacher: owner } = await createTestTeacher(ctx.db);
    const { teacher: intruder } = await createTestTeacher(ctx.db);
    const registrar = await createTestStudent(ctx.db, owner.id);
    const dependent = await createTestStudent(ctx.db, owner.id);

    await loginAs(intruder.id);
    const result = await studentLinks.addStudentLinkAction(registrar.id, dependent.id);

    expect(result.error).toBeTruthy();
    const count = await ctx.db.studentLink.count({ where: { registrarId: registrar.id } });
    expect(count).toBe(0);
  });

  it("does not allow mixing a student from another teacher into the link", async () => {
    const { teacher: owner } = await createTestTeacher(ctx.db);
    const { teacher: other } = await createTestTeacher(ctx.db);
    const registrar = await createTestStudent(ctx.db, owner.id);
    const foreignDependent = await createTestStudent(ctx.db, other.id);

    await loginAs(owner.id);
    const result = await studentLinks.addStudentLinkAction(registrar.id, foreignDependent.id);

    expect(result.error).toBeTruthy();
  });
});

describe("removeStudentLinkAction", () => {
  it("removes an existing link", async () => {
    const { teacher } = await createTestTeacher(ctx.db);
    await loginAs(teacher.id);
    const registrar = await createTestStudent(ctx.db, teacher.id);
    const dependent = await createTestStudent(ctx.db, teacher.id);
    await studentLinks.addStudentLinkAction(registrar.id, dependent.id);
    const link = await ctx.db.studentLink.findUniqueOrThrow({
      where: { registrarId_dependentId: { registrarId: registrar.id, dependentId: dependent.id } },
    });

    const result = await studentLinks.removeStudentLinkAction(link.id);

    expect(result.error).toBeUndefined();
    expect(await ctx.db.studentLink.findUnique({ where: { id: link.id } })).toBeNull();
  });

  it("does not allow a teacher to remove another teacher's link", async () => {
    const { teacher: owner } = await createTestTeacher(ctx.db);
    const { teacher: intruder } = await createTestTeacher(ctx.db);
    const registrar = await createTestStudent(ctx.db, owner.id);
    const dependent = await createTestStudent(ctx.db, owner.id);
    await loginAs(owner.id);
    await studentLinks.addStudentLinkAction(registrar.id, dependent.id);
    const link = await ctx.db.studentLink.findUniqueOrThrow({
      where: { registrarId_dependentId: { registrarId: registrar.id, dependentId: dependent.id } },
    });

    await loginAs(intruder.id);
    const result = await studentLinks.removeStudentLinkAction(link.id);

    expect(result.error).toBeTruthy();
    expect(await ctx.db.studentLink.findUnique({ where: { id: link.id } })).not.toBeNull();
  });
});
