import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekRange, formatWeekRangeLabel, formatWeekStartParam } from "@/lib/week";
import { CreateLessonButton } from "./lesson-form";
import { LessonRow, type RosterEntry } from "./lesson-row";
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

  const [lessons, allStudents] = await Promise.all([
    db.lesson.findMany({
      where: { teacherId: teacher.id, startsAt: { gte: start, lt: end } },
      orderBy: { startsAt: "asc" },
    }),
    db.student.findMany({
      where: { teacherId: teacher.id },
      orderBy: { firstName: "asc" },
    }),
  ]);

  const lessonIds = lessons.map((lesson) => lesson.id);
  const registrations = await db.registration.findMany({
    where: { lessonId: { in: lessonIds }, status: { in: ["registered", "waitlisted"] } },
    include: { student: true },
    orderBy: { createdAt: "asc" },
  });

  const rosterByLessonId = new Map<string, RosterEntry[]>();
  for (const registration of registrations) {
    const entry: RosterEntry = {
      registrationId: registration.id,
      status: registration.status as "registered" | "waitlisted",
      student: {
        id: registration.student.id,
        firstName: registration.student.firstName,
        lastName: registration.student.lastName,
        phone: registration.student.phone,
      },
    };
    const list = rosterByLessonId.get(registration.lessonId) ?? [];
    list.push(entry);
    rosterByLessonId.set(registration.lessonId, list);
  }

  const studentOptions = allStudents.map((student) => ({
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
  }));

  return (
    <main className="flex flex-1 flex-col items-center px-6 pt-4 pb-12">
      <div className="w-full max-w-md">
        <div className="relative flex h-9 items-center">
          <Link
            href="/dashboard"
            className="relative z-10 text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
          >
            ← חזרה
          </Link>
          <h1 className="absolute inset-x-0 text-center text-xl font-semibold">שיעורי השבוע</h1>
        </div>

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
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              roster={rosterByLessonId.get(lesson.id) ?? []}
              allStudents={studentOptions}
            />
          ))}
        </ul>
        <CreateLessonButton
          weekOffset={weekOffset}
          defaultCapacity={teacher.defaultLessonCapacity}
          defaultDuration={teacher.defaultLessonDuration}
        />
      </div>
    </main>
  );
}
