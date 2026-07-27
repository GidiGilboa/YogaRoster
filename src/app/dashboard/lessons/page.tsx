import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekRange, formatWeekRangeLabel } from "@/lib/week";
import { CreateLessonButton } from "./lesson-form";
import { LessonRow } from "./lesson-row";

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
        <h1 className="mb-4 text-xl font-semibold">שיעורי השבוע</h1>

        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/dashboard/lessons?week=${weekOffset - 1}`}
            aria-label="שבוע קודם"
            className="rounded-md border border-zinc-300 p-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
          <span className="text-sm font-medium">{formatWeekRangeLabel(start, end)}</span>
          <Link
            href={`/dashboard/lessons?week=${weekOffset + 1}`}
            aria-label="שבוע הבא"
            className="rounded-md border border-zinc-300 p-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </div>

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
