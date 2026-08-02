"use client";

import { ChevronLeft } from "lucide-react";
import { LessonFormModal, type LessonData } from "./lesson-form";

const dayFormatter = new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "Asia/Jerusalem" });
const timeFormatter = new Intl.DateTimeFormat("he-IL", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jerusalem",
});

export type StudentOption = {
  id: string;
  firstName: string;
  lastName: string;
};

export type RosterEntry = {
  registrationId: string;
  status: "registered" | "waitlisted";
  student: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
};

export function LessonRow({
  lesson,
  roster,
  allStudents,
}: {
  lesson: LessonData;
  roster: RosterEntry[];
  allStudents: StudentOption[];
}) {
  const registeredCount = roster.filter((entry) => entry.status === "registered").length;

  return (
    <LessonFormModal
      lesson={lesson}
      roster={roster}
      allStudents={allStudents}
      trigger={(open) => (
        <li>
          <button
            type="button"
            onClick={open}
            className="flex w-full items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 text-right hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            <div className="flex flex-col items-center rounded-md bg-blue-50 px-3 py-1.5 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <span className="text-xs font-medium">{dayFormatter.format(lesson.startsAt)}</span>
              <span className="text-sm font-semibold">{timeFormatter.format(lesson.startsAt)}</span>
            </div>

            <div className="min-w-0 flex-1 px-2">
              <div className="font-medium">
                {lesson.durationMinutes} דקות · {registeredCount}/{lesson.capacity} נרשמו
              </div>
              {lesson.comment && (
                <div className="text-sm text-zinc-600 dark:text-zinc-400">{lesson.comment}</div>
              )}
            </div>

            <ChevronLeft className="h-5 w-5 shrink-0 text-zinc-400" />
          </button>
        </li>
      )}
    />
  );
}
