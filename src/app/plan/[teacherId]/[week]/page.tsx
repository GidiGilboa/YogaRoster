import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { getWeekRangeFromStartParam, formatWeekRangeLabel, formatWeekStartParam, shiftWeekStart } from "@/lib/week";
import { getIdentifiedStudent } from "@/lib/studentAuth";

const lessonDateFormatter = new Intl.DateTimeFormat("he-IL", {
  weekday: "long",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type PlanPageParams = { teacherId: string; week: string };

async function loadPlan(params: PlanPageParams) {
  const { teacherId, week } = params;
  const range = getWeekRangeFromStartParam(week);
  if (!range) return null;

  const teacher = await db.teacher.findUnique({ where: { id: teacherId } });
  if (!teacher) return null;

  return { teacher, range };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PlanPageParams>;
}): Promise<Metadata> {
  const resolved = await loadPlan(await params);
  if (!resolved) return {};

  const { teacher, range } = resolved;
  const label = formatWeekRangeLabel(range.start, range.end);

  return {
    title: `שיעורי יוגה השבוע — ${teacher.name}`,
    description: label,
    openGraph: {
      title: `שיעורי יוגה השבוע — ${teacher.name}`,
      description: label,
    },
  };
}

export default async function PublicPlanPage({ params }: { params: Promise<PlanPageParams> }) {
  const resolvedParams = await params;
  const resolved = await loadPlan(resolvedParams);
  if (!resolved) notFound();

  const { teacher, range } = resolved;
  const { teacherId, week } = resolvedParams;

  const publication = await db.weeklyPlanPublication.findUnique({
    where: { teacherId_weekStart: { teacherId, weekStart: range.start } },
  });

  if (!publication) {
    return (
      <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-black">
        <div className="w-full max-w-md text-center">
          <h1 className="mb-2 text-xl font-semibold">שיעורי יוגה עם {teacher.name}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">התוכנית לשבוע זה עדיין לא פורסמה.</p>
        </div>
      </main>
    );
  }

  const student = await getIdentifiedStudent(teacherId);
  if (!student) {
    redirect(`/plan/${teacherId}/${week}/identify?returnTo=${encodeURIComponent(`/plan/${teacherId}/${week}`)}`);
  }

  const prevStart = shiftWeekStart(range.start, -1);
  const nextStart = shiftWeekStart(range.start, 1);

  const [lessons, prevPublished, nextPublished] = await Promise.all([
    db.lesson.findMany({
      where: { teacherId, startsAt: { gte: range.start, lt: range.end } },
      orderBy: { startsAt: "asc" },
    }),
    db.weeklyPlanPublication.findUnique({
      where: { teacherId_weekStart: { teacherId, weekStart: prevStart } },
    }),
    db.weeklyPlanPublication.findUnique({
      where: { teacherId_weekStart: { teacherId, weekStart: nextStart } },
    }),
  ]);

  return (
    <main className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-12 dark:bg-black">
      <div className="w-full max-w-md">
        <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
          {student.firstName.trim() ? `היי, ${student.firstName}!` : "היי!"}
        </p>
        <h1 className="mb-1 text-xl font-semibold">שיעורי יוגה עם {teacher.name}</h1>
        <p className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          יתרת שיעורים: {student.credits}
        </p>

        <div className="mb-6 flex items-center justify-between">
          {prevPublished ? (
            <Link
              href={`/plan/${teacherId}/${formatWeekStartParam(prevStart)}`}
              aria-label="שבוע קודם"
              className="rounded-md border border-zinc-300 p-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="rounded-md border border-zinc-200 p-1.5 opacity-30 dark:border-zinc-800">
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
          <span className="text-sm font-medium">{formatWeekRangeLabel(range.start, range.end)}</span>
          {nextPublished ? (
            <Link
              href={`/plan/${teacherId}/${formatWeekStartParam(nextStart)}`}
              aria-label="שבוע הבא"
              className="rounded-md border border-zinc-300 p-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : (
            <span className="rounded-md border border-zinc-200 p-1.5 opacity-30 dark:border-zinc-800">
              <ChevronLeft className="h-4 w-4" />
            </span>
          )}
        </div>

        <ul className="flex flex-col gap-2">
          {lessons.length === 0 && (
            <li className="text-sm text-zinc-500 dark:text-zinc-400">אין שיעורים מתוכננים לשבוע זה.</li>
          )}
          {lessons.map((lesson) => (
            <li
              key={lesson.id}
              className="rounded-md border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="font-medium">{lesson.title}</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {lessonDateFormatter.format(lesson.startsAt)} · {lesson.durationMinutes} דקות · עד{" "}
                {lesson.capacity} תלמידות
              </div>
              {lesson.comment && (
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{lesson.comment}</div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
