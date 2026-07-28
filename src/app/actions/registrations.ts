"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getIdentifiedStudent } from "@/lib/studentAuth";
import { requireTeacher } from "@/lib/auth";

export type RegistrationOutcome = {
  lessonId: string;
  title: string;
  status: "registered" | "waitlisted" | "cancelled";
};

export type RegisterActionState = {
  error?: string;
  results?: RegistrationOutcome[];
  remainingCredits?: number;
  ranOutOfCredits?: boolean;
};

export async function updateRegistrationsAction(
  teacherId: string,
  _prevState: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const student = await getIdentifiedStudent(teacherId);
  if (!student) {
    return { error: "יש להזדהות מחדש." };
  }

  const allLessonIds = formData.getAll("allLessonIds").map(String);
  const checkedLessonIds = new Set(formData.getAll("lessonIds").map(String));

  const results: RegistrationOutcome[] = [];

  for (const lessonId of allLessonIds) {
    const isChecked = checkedLessonIds.has(lessonId);

    const outcome = await db.$transaction(async (tx) => {
      const lesson = await tx.lesson.findUnique({ where: { id: lessonId } });
      if (!lesson || lesson.teacherId !== teacherId) {
        return null;
      }

      const existing = await tx.registration.findUnique({
        where: { studentId_lessonId: { studentId: student.id, lessonId } },
      });
      const isCurrentlyActive = Boolean(existing && existing.status !== "cancelled");

      if (!isChecked) {
        if (existing && isCurrentlyActive) {
          if (existing.creditDeducted) {
            await tx.student.update({
              where: { id: student.id },
              data: { credits: { increment: 1 } },
            });
          }
          await tx.registration.update({
            where: { id: existing.id },
            data: { status: "cancelled", creditDeducted: false },
          });
          return { lessonId, title: lesson.title, status: "cancelled" as const };
        }
        return null;
      }

      if (existing && isCurrentlyActive) {
        return {
          lessonId,
          title: lesson.title,
          status: existing.status as "registered" | "waitlisted",
        };
      }

      const registeredCount = await tx.registration.count({
        where: { lessonId, status: "registered" },
      });
      const willRegister = registeredCount < lesson.capacity;
      const status = willRegister ? "registered" : "waitlisted";

      if (existing) {
        await tx.registration.update({
          where: { id: existing.id },
          data: { status, creditDeducted: willRegister },
        });
      } else {
        await tx.registration.create({
          data: { studentId: student.id, lessonId, status, creditDeducted: willRegister },
        });
      }

      if (willRegister) {
        await tx.student.update({
          where: { id: student.id },
          data: { credits: { decrement: 1 } },
        });
      }

      return { lessonId, title: lesson.title, status: status as "registered" | "waitlisted" };
    });

    if (outcome) {
      results.push(outcome);
    }
  }

  const updatedStudent = await db.student.findUnique({ where: { id: student.id } });
  const remainingCredits = updatedStudent?.credits ?? student.credits;

  revalidatePath(`/plan/${teacherId}`);

  return {
    results,
    remainingCredits,
    ranOutOfCredits: remainingCredits <= 0,
  };
}

export type TeacherRegistrationActionState = {
  error?: string;
};

export async function teacherCancelRegistrationAction(
  registrationId: string
): Promise<TeacherRegistrationActionState> {
  const teacher = await requireTeacher();

  const registration = await db.registration.findUnique({
    where: { id: registrationId },
    include: { lesson: true },
  });
  if (!registration || registration.lesson.teacherId !== teacher.id) {
    return { error: "ההרשמה לא נמצאה." };
  }

  await db.$transaction(async (tx) => {
    if (registration.creditDeducted) {
      await tx.student.update({
        where: { id: registration.studentId },
        data: { credits: { increment: 1 } },
      });
    }
    await tx.registration.update({
      where: { id: registrationId },
      data: { status: "cancelled", creditDeducted: false },
    });
  });

  revalidatePath("/dashboard/lessons");
  return {};
}

export async function manualRegisterStudentAction(
  lessonId: string,
  studentId: string
): Promise<TeacherRegistrationActionState> {
  const teacher = await requireTeacher();

  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || lesson.teacherId !== teacher.id) {
    return { error: "השיעור לא נמצא." };
  }

  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student || student.teacherId !== teacher.id) {
    return { error: "התלמידה לא נמצאה." };
  }

  const existing = await db.registration.findUnique({
    where: { studentId_lessonId: { studentId, lessonId } },
  });
  if (existing && existing.status !== "cancelled") {
    return { error: "התלמידה כבר רשומה לשיעור זה." };
  }

  const result = await db.$transaction(async (tx) => {
    const registeredCount = await tx.registration.count({
      where: { lessonId, status: "registered" },
    });
    if (registeredCount >= lesson.capacity) {
      return { error: "השיעור מלא, לא ניתן להוסיף תלמידה נוספת." };
    }

    if (existing) {
      await tx.registration.update({
        where: { id: existing.id },
        data: { status: "registered", creditDeducted: true },
      });
    } else {
      await tx.registration.create({
        data: { studentId, lessonId, status: "registered", creditDeducted: true },
      });
    }
    await tx.student.update({
      where: { id: studentId },
      data: { credits: { decrement: 1 } },
    });

    return {};
  });

  if (result.error) {
    return result;
  }

  revalidatePath("/dashboard/lessons");
  return {};
}
