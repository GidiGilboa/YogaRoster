import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { getWeekRangeFromStartParam, formatWeekRangeLabel, formatWeekStartParam, shiftWeekStart } from "@/lib/week";
import { getIdentifiedStudent } from "@/lib/studentAuth";
import { RegistrationList, type PlanLesson } from "./registration-list";

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

  const [lessons, prevPublished, nextPublished, registrations] = await Promise.all([
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
    db.registration.findMany({
      where: { studentId: student.id, status: { in: ["registered", "waitlisted"] } },
    }),
  ]);

  const lessonIds = lessons.map((lesson) => lesson.id);
  const registeredCounts = await db.registration.groupBy({
    by: ["lessonId"],
    where: { lessonId: { in: lessonIds }, status: "registered" },
    _count: { _all: true },
  });
  const registeredCountByLessonId = new Map(registeredCounts.map((r) => [r.lessonId, r._count._all]));

  const registrationByLessonId = new Map(registrations.map((r) => [r.lessonId, r.status]));
  const planLessons: PlanLesson[] = lessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    startsAt: lesson.startsAt,
    durationMinutes: lesson.durationMinutes,
    capacity: lesson.capacity,
    comment: lesson.comment,
    registeredCount: registeredCountByLessonId.get(lesson.id) ?? 0,
    registrationStatus: (registrationByLessonId.get(lesson.id) as "registered" | "waitlisted" | undefined) ?? null,
  }));

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

        <RegistrationList teacherId={teacherId} lessons={planLessons} />
      </div>
    </main>
  );
}
