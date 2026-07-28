import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekRange, formatWeekRangeLabel, formatWeekStartParam } from "@/lib/week";
import { CreateLessonButton } from "./lesson-form";
import { LessonRow } from "./lesson-row";
import { LessonsToolbar } from "./lessons-toolbar";

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const teacher = await requireTeacher();
  const { week } = await searchParams;
  const weekOffset = Number.isInteger(Number(week)) ? Number(week) : 0;
  const { start, end } = getWeekRange(weekOffset);

  const lessons = await db.lesson.findMany({
    where: { teacherId: teacher.id, startsAt: { gte: start, lt: end } },
    orderBy: { startsAt: "asc" },
  });

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/dashboard"
          className="mb-4 inline-block text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← חזרה
        </Link>

        <LessonsToolbar
          teacherId={teacher.id}
          weekOffset={weekOffset}
          weekStartParam={formatWeekStartParam(start)}
          weekLabel={formatWeekRangeLabel(start, end)}
          hasLessonsThisWeek={lessons.length > 0}
        />

        <ul className="mb-6 flex flex-col gap-2">
          {lessons.length === 0 && (
            <li className="text-sm text-zinc-500 dark:text-zinc-400">אין עדיין שיעורים השבוע.</li>
          )}
          {lessons.map((lesson) => (
            <LessonRow key={lesson.id} lesson={lesson} />
          ))}
        </ul>
        <CreateLessonButton weekOffset={weekOffset} />
      </div>
    </main>
  );
}
