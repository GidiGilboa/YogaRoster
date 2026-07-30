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
});

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
      <ul className="flex flex-col gap-2">
        {lessons.length === 0 && (
          <li className="text-sm text-zinc-500 dark:text-zinc-400">אין שיעורים מתוכננים לשבוע זה.</li>
        )}
        {lessons.map((lesson) => (
          <li
            key={lesson.id}
            className="relative flex items-center gap-3 rounded-md border-2 border-zinc-400 bg-transparent px-4 py-1.5 dark:border-zinc-500"
          >
            <input
              type="checkbox"
              name="lessonIds"
              value={lesson.id}
              defaultChecked={lesson.registrationStatus !== null}
              className="h-5 w-5 shrink-0 accent-blue-600"
              aria-label={`בחירת שיעור ${lessonDateFormatter.format(lesson.startsAt)}`}
            />
            <input type="hidden" name="allLessonIds" value={lesson.id} />

            <span className="absolute top-1 left-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {lesson.registeredCount}/{lesson.capacity}
            </span>

            {lesson.registrationStatus && (
              <span
                className={`absolute bottom-1 left-2 rounded-md px-2 py-0.5 text-xs font-medium ${
                  lesson.registrationStatus === "registered"
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {lesson.registrationStatus === "registered" ? "רשומה" : "ברשימת המתנה"}
              </span>
            )}

            <div className="min-w-0 flex-1 px-2 pt-2.5 pb-2.5">
              <div className="font-medium">
                {lessonDateFormatter.format(lesson.startsAt)} · {lesson.durationMinutes} דקות
              </div>
              {lesson.comment && (
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{lesson.comment}</div>
              )}
            </div>
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
