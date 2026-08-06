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
  //
  // Fetches the plan page first rather than guessing the image URL
  // directly: Next appends a hash query string to the og:image URL
  // (changes on every deploy) that isn't just `/opengraph-image` with no
  // query - hitting that bare path warms a cache entry nobody actually
  // requests, leaving the real one (with the hash) just as cold as before.
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const planUrl = `${appUrl}/plan/${teacher.id}/${weekStartParam}`;
  fetch(planUrl, { headers: { "User-Agent": "facebookexternalhit/1.1" } })
    .then((res) => res.text())
    .then((html) => {
      const match = /property="og:image" content="([^"]+)"/.exec(html);
      if (!match) throw new Error("og:image tag not found in plan page response");
      return fetch(match[1]);
    })
    .catch((error) => {
      console.error(`Failed to pre-warm share image for teacher ${teacher.id}, week ${weekStartParam}`, error);
    });

  return {};
}
