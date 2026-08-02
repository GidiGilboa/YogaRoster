import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { getWeekRangeFromStartParam, formatWeekRangeLabel, formatWeekStartParam, shiftWeekStart } from "@/lib/week";
import { getIdentifiedStudent } from "@/lib/studentAuth";
import { RegistrationList, type PlanLesson, type RegisterAsPerson } from "./registration-list";

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

export default async function PublicPlanPage({
  params,
  searchParams,
}: {
  params: Promise<PlanPageParams>;
  searchParams: Promise<{ as?: string }>;
}) {
  const resolvedParams = await params;
  const resolved = await loadPlan(resolvedParams);
  if (!resolved) notFound();

  const { teacher, range } = resolved;
  const { teacherId, week } = resolvedParams;
  const { as: requestedActingId } = await searchParams;

  const backgroundStyle: React.CSSProperties | undefined = teacher.backgroundImageUrl
    ? {
        backgroundImage: `url(${teacher.backgroundImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }
    : undefined;
  const cardClassName = teacher.backgroundImageUrl
    ? "w-full max-w-md rounded-lg bg-white/70 p-6 shadow-sm dark:bg-black/60"
    : "w-full max-w-md";

  const publication = await db.weeklyPlanPublication.findUnique({
    where: { teacherId_weekStart: { teacherId, weekStart: range.start } },
  });

  if (!publication) {
    return (
      <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-black" style={backgroundStyle}>
        <div className={`${cardClassName} text-center`}>
          <h1 className="mb-2 text-xl font-semibold">שיעורי יוגה עם {teacher.name}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">התוכנית לשבוע זה עדיין לא פורסמה.</p>
        </div>
      </main>
    );
  }

  const identifiedStudent = await getIdentifiedStudent(teacherId);
  if (!identifiedStudent) {
    redirect(`/plan/${teacherId}/${week}/identify?returnTo=${encodeURIComponent(`/plan/${teacherId}/${week}`)}`);
  }

  const dependentLinks = await db.studentLink.findMany({
    where: { registrarId: identifiedStudent.id },
    include: { dependent: true },
    orderBy: { createdAt: "asc" },
  });

  const people: RegisterAsPerson[] = [
    { id: identifiedStudent.id, name: `${identifiedStudent.firstName} (את)`, isActive: false },
    ...dependentLinks.map((link) => ({
      id: link.dependent.id,
      name: link.dependent.firstName,
      isActive: false,
    })),
  ];

  const activeStudentId =
    requestedActingId && people.some((person) => person.id === requestedActingId)
      ? requestedActingId
      : identifiedStudent.id;
  for (const person of people) {
    person.isActive = person.id === activeStudentId;
  }

  const activeStudent =
    activeStudentId === identifiedStudent.id
      ? identifiedStudent
      : (dependentLinks.find((link) => link.dependent.id === activeStudentId)?.dependent ?? identifiedStudent);

  const asParam = people.length > 1 ? `?as=${activeStudentId}` : "";

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
      where: { studentId: activeStudentId, status: { in: ["registered", "waitlisted"] } },
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
    startsAt: lesson.startsAt,
    durationMinutes: lesson.durationMinutes,
    capacity: lesson.capacity,
    comment: lesson.comment,
    registeredCount: registeredCountByLessonId.get(lesson.id) ?? 0,
    registrationStatus: (registrationByLessonId.get(lesson.id) as "registered" | "waitlisted" | undefined) ?? null,
  }));

  return (
    <main className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-8 dark:bg-black" style={backgroundStyle}>
      <div className={cardClassName}>
        <p className="mb-1 text-sm text-zinc-600 dark:text-zinc-400">
          {identifiedStudent.firstName.trim() ? `היי, ${identifiedStudent.firstName}!` : "היי!"}
        </p>
        <h1 className="mb-1 text-xl font-semibold">שיעורי יוגה עם {teacher.name}</h1>

        {people.length > 1 && (
          <div className="mb-2 flex gap-2 overflow-x-auto">
            {people.map((person) => (
              <Link
                key={person.id}
                href={`/plan/${teacherId}/${week}?as=${person.id}`}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
                  person.isActive
                    ? "border-2 border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {person.name}
              </Link>
            ))}
          </div>
        )}

        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          יתרת שיעורים: {activeStudent.credits}
        </p>

        <div className="mb-3 flex items-center justify-between">
          {prevPublished ? (
            <Link
              href={`/plan/${teacherId}/${formatWeekStartParam(prevStart)}${asParam}`}
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
              href={`/plan/${teacherId}/${formatWeekStartParam(nextStart)}${asParam}`}
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

        <RegistrationList teacherId={teacherId} lessons={planLessons} actingStudentId={activeStudentId} />
      </div>
    </main>
  );
}
