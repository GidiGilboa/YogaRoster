import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { getWeekRangeFromStartParam, formatWeekRangeLabel, formatWeekStartParam, shiftWeekStart } from "@/lib/week";
import { getIdentifiedStudent } from "@/lib/studentAuth";
import { RegistrationList, type PlanLesson, type RegisterAsPerson } from "./registration-list";

type PlanPageParams = { teacherId: string; week: string };

// Link-preview crawlers never carry the student-identify cookie, so without
// this they'd hit the same redirect to /identify a real first-time visitor
// does - and since crawlers evaluate the page they land on (following
// redirects) rather than the originally-requested URL, they'd read
// /identify's generic metadata instead of this page's teacher-specific
// title/image, no matter how correct this page's own metadata is.
function isSocialPreviewCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return /facebookexternalhit|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|Pinterest|Google-InspectionTool/i.test(
    userAgent
  );
}

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
  const resolvedParams = await params;
  const resolved = await loadPlan(resolvedParams);
  if (!resolved) return {};

  const { teacher } = resolved;
  const { teacherId, week } = resolvedParams;
  const pageTitle = `שיעורי יוגה השבוע — ${teacher.name}`;

  return {
    title: pageTitle,
    openGraph: {
      // The teacher's own message becomes the bold headline a link preview
      // shows (WhatsApp, iMessage, etc.) - falls back to the generic title
      // when she hasn't set one.
      title: teacher.shareMessage || pageTitle,
      // Open Graph's spec (ogp.me) lists og:title/og:type/og:image/og:url as
      // the 4 required properties - Facebook's Sharing Debugger flagged
      // og:url and og:type as missing, which can make crawlers (WhatsApp
      // shares Meta's scraping infra) refuse to render a full card at all,
      // not just cache a stale one.
      url: `/plan/${teacherId}/${week}`,
      type: "website",
      // A single space, not "": leaving this unset (or "") doesn't suppress
      // og:description - Next.js treats both as falsy and fills it in from
      // the effective top-level `description` (this page's own, or
      // inherited from root layout's if this page doesn't set one either),
      // defeating the single-line card this page is deliberately built
      // around. A non-empty value bypasses that fallback and renders as
      // nothing visible in the actual link preview.
      description: " ",
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
    const userAgent = (await headers()).get("user-agent");
    if (isSocialPreviewCrawler(userAgent)) {
      // Stay on this exact URL so the crawler reads this page's own
      // generateMetadata (title/image) instead of following a redirect to
      // /identify and reading its generic fallback metadata. Content here
      // is irrelevant - crawlers only read <head>, never render the body.
      return (
        <main
          className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-black"
          style={backgroundStyle}
        >
          <div className={`${cardClassName} text-center`}>
            <h1 className="text-xl font-semibold">שיעורי יוגה עם {teacher.name}</h1>
          </div>
        </main>
      );
    }
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
