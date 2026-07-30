import type { PrismaClient } from "@/generated/prisma/client";

// Imported lazily (inside the function body, not here) because @/lib/auth
// transitively imports @/lib/db, which reads DATABASE_URL at module-load
// time. A static import here would evaluate before a test's beforeAll has
// had a chance to point DATABASE_URL at its throwaway database.

let counter = 0;
function unique(): number {
  counter += 1;
  return counter;
}

function randomIsraeliPhone(): string {
  const n = unique();
  return `05${String(n).padStart(8, "0")}`;
}

export async function createTestTeacher(
  db: PrismaClient,
  overrides: Partial<{ name: string; email: string; password: string }> = {}
) {
  const password = overrides.password ?? "password123";
  const { hashPassword } = await import("@/lib/auth");
  const passwordHash = await hashPassword(password);
  const teacher = await db.teacher.create({
    data: {
      name: overrides.name ?? "מורה בדיקה",
      email: overrides.email ?? `teacher-${unique()}@example.com`,
      passwordHash,
    },
  });
  return { teacher, password };
}

export async function createTestStudent(
  db: PrismaClient,
  teacherId: string,
  overrides: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    credits: number;
  }> = {}
) {
  return db.student.create({
    data: {
      teacherId,
      firstName: overrides.firstName ?? "תלמידה",
      lastName: overrides.lastName ?? `בדיקה${unique()}`,
      phone: overrides.phone ?? randomIsraeliPhone(),
      email: overrides.email ?? null,
      credits: overrides.credits ?? 10,
    },
  });
}

export async function createTestLesson(
  db: PrismaClient,
  teacherId: string,
  overrides: Partial<{
    startsAt: Date;
    durationMinutes: number;
    capacity: number;
    comment: string | null;
  }> = {}
) {
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() + 1);

  return db.lesson.create({
    data: {
      teacherId,
      startsAt: overrides.startsAt ?? defaultStart,
      durationMinutes: overrides.durationMinutes ?? 60,
      capacity: overrides.capacity ?? 10,
      comment: overrides.comment ?? null,
    },
  });
}
