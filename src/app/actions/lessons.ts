"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekRange } from "@/lib/week";

export type LessonActionState = {
  error?: string;
};

type ParsedLessonInput = {
  title: string;
  startsAt: Date;
  durationMinutes: number;
  capacity: number;
  comment: string | null;
};

function parseLessonForm(formData: FormData): ParsedLessonInput | { error: string } {
  const title = String(formData.get("title") ?? "").trim();
  const startsAtRaw = String(formData.get("startsAt") ?? "");
  const durationRaw = String(formData.get("duration") ?? "");
  const capacityRaw = String(formData.get("capacity") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();

  if (!title) {
    return { error: "יש להזין כותרת לשיעור." };
  }

  const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    return { error: "יש לבחור תאריך ושעה תקינים." };
  }

  const duration = Number(durationRaw);
  if (!Number.isInteger(duration) || duration <= 0) {
    return { error: "יש להזין משך שיעור תקין בדקות." };
  }

  const capacity = Number(capacityRaw);
  if (!Number.isInteger(capacity) || capacity <= 0) {
    return { error: "יש להזין מספר מקומות תקין." };
  }

  return { title, startsAt, durationMinutes: duration, capacity, comment: comment || null };
}

export async function createLessonAction(
  _prevState: LessonActionState,
  formData: FormData
): Promise<LessonActionState> {
  const teacher = await requireTeacher();

  const parsed = parseLessonForm(formData);
  if ("error" in parsed) {
    return parsed;
  }

  if (parsed.startsAt < new Date()) {
    return { error: "לא ניתן ליצור שיעור בעבר." };
  }

  await db.lesson.create({
    data: { teacherId: teacher.id, ...parsed },
  });

  revalidatePath("/dashboard/lessons");
  return {};
}

export async function updateLessonAction(
  lessonId: string,
  _prevState: LessonActionState,
  formData: FormData
): Promise<LessonActionState> {
  const teacher = await requireTeacher();

  const existing = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!existing || existing.teacherId !== teacher.id) {
    return { error: "השיעור לא נמצא." };
  }

  const parsed = parseLessonForm(formData);
  if ("error" in parsed) {
    return parsed;
  }

  await db.lesson.update({
    where: { id: lessonId },
    data: parsed,
  });

  revalidatePath("/dashboard/lessons");
  return {};
}

export async function deleteLessonAction(lessonId: string): Promise<LessonActionState> {
  const teacher = await requireTeacher();

  const existing = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!existing || existing.teacherId !== teacher.id) {
    return { error: "השיעור לא נמצא." };
  }

  await db.lesson.delete({ where: { id: lessonId } });

  revalidatePath("/dashboard/lessons");
  return {};
}

export type CopyWeekActionState = {
  status: "success" | "empty" | "past";
};

export async function copyPreviousWeekAction(weekOffset: number): Promise<CopyWeekActionState> {
  const teacher = await requireTeacher();

  const current = getWeekRange(weekOffset);
  if (current.end <= new Date()) {
    return { status: "past" };
  }

  const previous = getWeekRange(weekOffset - 1);
  const previousLessons = await db.lesson.findMany({
    where: { teacherId: teacher.id, startsAt: { gte: previous.start, lt: previous.end } },
  });

  if (previousLessons.length === 0) {
    return { status: "empty" };
  }

  await db.lesson.createMany({
    data: previousLessons.map((lesson) => {
      const startsAt = new Date(lesson.startsAt);
      startsAt.setDate(startsAt.getDate() + 7);
      return {
        teacherId: teacher.id,
        title: lesson.title,
        startsAt,
        durationMinutes: lesson.durationMinutes,
        capacity: lesson.capacity,
        comment: lesson.comment,
      };
    }),
  });

  revalidatePath("/dashboard/lessons");
  return { status: "success" };
}
