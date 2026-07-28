"use server";

import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekRangeFromStartParam } from "@/lib/week";

export type PublishActionState = {
  error?: string;
};

export async function publishWeekAction(weekStartParam: string): Promise<PublishActionState> {
  const teacher = await requireTeacher();

  const range = getWeekRangeFromStartParam(weekStartParam);
  if (!range) {
    return { error: "שבוע לא תקין." };
  }

  const lessonCount = await db.lesson.count({
    where: { teacherId: teacher.id, startsAt: { gte: range.start, lt: range.end } },
  });
  if (lessonCount === 0) {
    return { error: "אי אפשר לפרסם שבוע ללא שיעורים." };
  }

  await db.weeklyPlanPublication.upsert({
    where: { teacherId_weekStart: { teacherId: teacher.id, weekStart: range.start } },
    create: { teacherId: teacher.id, weekStart: range.start },
    update: {},
  });

  return {};
}
