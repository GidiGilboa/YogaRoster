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

  // Fire-and-forget: warms the cache added in opengraph-image.tsx so the
  // slow first render (image composition, ~7s on this box) happens now
  // instead of when WhatsApp fetches the link a moment after she shares
  // it and gives up waiting. Not awaited - publishing shouldn't wait on
  // this, and a failure here shouldn't fail the publish itself.
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  fetch(`${appUrl}/plan/${teacher.id}/${weekStartParam}/opengraph-image`).catch((error) => {
    console.error(`Failed to pre-warm share image for teacher ${teacher.id}, week ${weekStartParam}`, error);
  });

  return {};
}
