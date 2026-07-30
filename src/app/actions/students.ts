"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePhone, isValidIsraeliMobile } from "@/lib/phone";

export type StudentActionState = {
  error?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ParsedStudentInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  credits: number;
};

function parseStudentForm(formData: FormData): ParsedStudentInput | { error: string } {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const email = String(formData.get("email") ?? "").trim();
  const creditsRaw = String(formData.get("credits") ?? "0").trim();

  if (!firstName) {
    return { error: "יש להזין שם פרטי." };
  }
  if (!lastName) {
    return { error: "יש להזין שם משפחה." };
  }
  if (!isValidIsraeliMobile(phone)) {
    return { error: "מספר הטלפון חייב להתחיל ב-05 ולכלול 10 ספרות." };
  }
  if (email && !EMAIL_REGEX.test(email)) {
    return { error: "יש להזין כתובת אימייל תקינה." };
  }

  const credits = Number(creditsRaw);
  if (!Number.isInteger(credits) || credits < 0) {
    return { error: "יש להזין יתרת שיעורים תקינה." };
  }

  return { firstName, lastName, phone, email: email || null, credits };
}

export async function createStudentAction(
  _prevState: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const teacher = await requireTeacher();

  const parsed = parseStudentForm(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const existing = await db.student.findUnique({
    where: { teacherId_phone: { teacherId: teacher.id, phone: parsed.phone } },
  });
  if (existing) {
    return { error: "כבר קיימת תלמידה עם מספר הטלפון הזה." };
  }

  await db.student.create({
    data: { teacherId: teacher.id, ...parsed },
  });

  revalidatePath("/dashboard/students");
  return {};
}

export async function updateStudentAction(
  studentId: string,
  _prevState: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const teacher = await requireTeacher();

  const existingStudent = await db.student.findUnique({ where: { id: studentId } });
  if (!existingStudent || existingStudent.teacherId !== teacher.id) {
    return { error: "התלמידה לא נמצאה." };
  }

  const parsed = parseStudentForm(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const phoneOwner = await db.student.findUnique({
    where: { teacherId_phone: { teacherId: teacher.id, phone: parsed.phone } },
  });
  if (phoneOwner && phoneOwner.id !== studentId) {
    return { error: "כבר קיימת תלמידה עם מספר הטלפון הזה." };
  }

  await db.student.update({
    where: { id: studentId },
    data: parsed,
  });

  revalidatePath("/dashboard/students");
  return {};
}

export type StudentLessonHistoryEntry = {
  registrationId: string;
  status: string;
  lesson: {
    id: string;
    startsAt: Date;
    durationMinutes: number;
  };
};

export type StudentLessonHistoryResult = {
  error?: string;
  entries?: StudentLessonHistoryEntry[];
};

export async function getStudentLessonHistoryAction(studentId: string): Promise<StudentLessonHistoryResult> {
  const teacher = await requireTeacher();

  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student || student.teacherId !== teacher.id) {
    return { error: "התלמידה לא נמצאה." };
  }

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const registrations = await db.registration.findMany({
    where: {
      studentId,
      status: { in: ["registered", "attended"] },
      lesson: { startsAt: { gte: threeMonthsAgo } },
    },
    include: { lesson: true },
    orderBy: { lesson: { startsAt: "desc" } },
  });

  return {
    entries: registrations.map((registration) => ({
      registrationId: registration.id,
      status: registration.status,
      lesson: {
        id: registration.lesson.id,
        startsAt: registration.lesson.startsAt,
        durationMinutes: registration.lesson.durationMinutes,
      },
    })),
  };
}
