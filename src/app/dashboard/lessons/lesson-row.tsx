"use client";

import { ChevronLeft } from "lucide-react";
import { LessonFormModal, type LessonData } from "./lesson-form";

const dayFormatter = new Intl.DateTimeFormat("he-IL", { weekday: "long" });
const timeFormatter = new Intl.DateTimeFormat("he-IL", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function LessonRow({ lesson }: { lesson: LessonData }) {
  return (
    <LessonFormModal
      lesson={lesson}
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
              <div className="font-medium">{lesson.title}</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {lesson.durationMinutes} דקות · עד {lesson.capacity} תלמידות
                {lesson.comment ? ` · ${lesson.comment}` : ""}
              </div>
            </div>

            <ChevronLeft className="h-5 w-5 shrink-0 text-zinc-400" />
          </button>
        </li>
      )}
    />
  );
}
