"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateRegistrationsAction, type RegisterActionState } from "@/app/actions/registrations";

const lessonDateFormatter = new Intl.DateTimeFormat("he-IL", {
  weekday: "long",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

// Compact-row formatters. Pinned to Asia/Jerusalem like every other date
// formatter in this app - deriving the weekday from the runtime's own local
// timezone (e.g. via Date.getDay()) would misreport it for a server running
// outside Israel, same class of bug already fixed elsewhere in this app.
const DAY_LETTER_BY_WEEKDAY: Record<string, string> = {
  Sun: "א׳",
  Mon: "ב׳",
  Tue: "ג׳",
  Wed: "ד׳",
  Thu: "ה׳",
  Fri: "ו׳",
  Sat: "ש׳",
};
const weekdayKeyFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Jerusalem" });
const dateDigitsFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  timeZone: "Asia/Jerusalem",
});
const timeFormatter = new Intl.DateTimeFormat("he-IL", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jerusalem",
});

function dayLetter(date: Date): string {
  return DAY_LETTER_BY_WEEKDAY[weekdayKeyFormatter.format(date)] ?? "";
}

// Deliberately doesn't gate on capacity - a "full" lesson still accepts a
// check (updateRegistrationsAction waitlists it on submit), this just tells
// the student what to expect before she does.
function availabilityLabel(lesson: PlanLesson): string {
  const remaining = lesson.capacity - lesson.registeredCount;
  if (remaining <= 0) return "מלא";
  if (remaining === 1) return "מקום אחרון";
  if (remaining <= 3) return `${remaining} מקומות פנויים`;
  return "פנוי";
}

export type PlanLesson = {
  id: string;
  startsAt: Date;
  durationMinutes: number;
  capacity: number;
  comment: string | null;
  registeredCount: number;
  registrationStatus: "registered" | "waitlisted" | null;
};

export type RegisterAsPerson = {
  id: string;
  name: string;
  isActive: boolean;
};

const initialState: RegisterActionState = {};

const RESULT_LABEL: Record<string, { icon: string; text: string }> = {
  registered: { icon: "✓", text: "נרשמת בהצלחה" },
  waitlisted: { icon: "⏳", text: "נוספת לרשימת המתנה" },
  cancelled: { icon: "✕", text: "ההרשמה בוטלה" },
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? "מעדכנת…" : "עדכון הרשמה"}
    </button>
  );
}

export function RegistrationList({
  teacherId,
  lessons,
  actingStudentId,
}: {
  teacherId: string;
  lessons: PlanLesson[];
  actingStudentId?: string;
}) {
  const action = (prevState: RegisterActionState, formData: FormData) =>
    updateRegistrationsAction(teacherId, prevState, formData);
  const [state, formAction] = useActionState(action, initialState);
  const lessonLabelById = new Map(lessons.map((lesson) => [lesson.id, lessonDateFormatter.format(lesson.startsAt)]));

  return (
    <form key={actingStudentId} action={formAction} className="flex flex-col gap-4">
      {actingStudentId && <input type="hidden" name="actingStudentId" value={actingStudentId} />}
      <ul className="flex flex-col divide-y-2 divide-zinc-200 border-t-2 border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {lessons.length === 0 && (
          <li className="py-3 text-sm text-zinc-500 dark:text-zinc-400">אין שיעורים מתוכננים לשבוע זה.</li>
        )}
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            {/* Inline padding (not a py-[5px] utility class) - same as the status
                column width below, arbitrary-value utilities weren't resolving to
                an actual computed style in this project's Tailwind build. */}
            <label
              className="flex cursor-pointer flex-col gap-1 active:bg-blue-50 dark:active:bg-blue-950/40"
              style={{ paddingTop: "5px", paddingBottom: "5px", minHeight: "52px" }}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="lessonIds"
                  value={lesson.id}
                  defaultChecked={lesson.registrationStatus !== null}
                  aria-label={`בחירת שיעור ${lessonDateFormatter.format(lesson.startsAt)}`}
                  className="relative h-6 w-6 shrink-0 appearance-none rounded-full border-2 border-zinc-300 after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-xs after:font-bold after:text-white after:content-[''] checked:border-blue-600 checked:bg-blue-600 checked:after:content-['✓'] dark:border-zinc-600"
                />
                <input type="hidden" name="allLessonIds" value={lesson.id} />

                <span className="w-9 shrink-0 leading-tight">
                  <span className="block text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {dayLetter(lesson.startsAt)}
                  </span>
                  <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                    {dateDigitsFormatter.format(lesson.startsAt)}
                  </span>
                </span>

                <span className="shrink-0 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {timeFormatter.format(lesson.startsAt)}
                </span>

                {/* Fixed-width column with physical text-align:left, not margin-left:auto
                    on the status itself - an auto margin only pushes based on that
                    element's own (variable) width, so "פנוי" and a padded "רשומה" pill
                    land at different left edges instead of forming a real column.
                    Inline width (not a w-24 utility class) since it wasn't resolving
                    to an actual computed width in this project's Tailwind build. */}
                <span className="ml-auto shrink-0 text-left" style={{ width: "6rem" }}>
                  <span
                    className={`whitespace-nowrap text-xs font-semibold ${
                      lesson.registrationStatus === "registered"
                        ? "rounded-full bg-green-100 px-2.5 py-1 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : lesson.registrationStatus === "waitlisted"
                          ? "rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {lesson.registrationStatus === "registered"
                      ? "רשומה"
                      : lesson.registrationStatus === "waitlisted"
                        ? "ברשימת המתנה"
                        : availabilityLabel(lesson)}
                  </span>
                </span>
              </div>

              {/* Comment gets its own full-width line below the row instead of
                  sharing the cramped time column - on this layout's actual (narrow)
                  content width there isn't room for a comment next to the status
                  pill without either one pushing the other out. Indented to roughly
                  align under the time digits (checkbox + gap + date column + gap). */}
              {lesson.comment && (
                <span
                  className="block break-words text-xs text-zinc-500 dark:text-zinc-400"
                  style={{ paddingRight: "5.25rem" }}
                >
                  {lesson.comment}
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>

      {lessons.length > 0 && <SubmitButton />}

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      )}

      {state.results && state.results.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          {state.results.map((result) => (
            <p key={result.lessonId}>
              {RESULT_LABEL[result.status].icon} {lessonLabelById.get(result.lessonId)} —{" "}
              {RESULT_LABEL[result.status].text}
            </p>
          ))}
          <p className="mt-1 font-medium">יתרת שיעורים: {state.remainingCredits}</p>
          {state.ranOutOfCredits && (
            <p className="text-amber-600 dark:text-amber-400">נגמרו לך השיעורים בכרטיסייה. אנא פני למורה.</p>
          )}
        </div>
      )}
    </form>
  );
}
