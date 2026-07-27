"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import {
  createLessonAction,
  updateLessonAction,
  deleteLessonAction,
  type LessonActionState,
} from "@/app/actions/lessons";

const initialState: LessonActionState = {};

const DAY_LETTERS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const DURATION_OPTIONS = [45, 60, 75, 90];

export type LessonData = {
  id: string;
  title: string;
  startsAt: Date;
  durationMinutes: number;
  capacity: number;
  comment: string | null;
};

function getWeekdaysFor(referenceDate: Date): Date[] {
  const sunday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() - referenceDate.getDay()
  );
  return DAY_LETTERS.map((_, i) => {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + i);
    return day;
  });
}

function toLocalDateTimeValue(date: Date, time: string): string {
  const [hh, mm] = time.split(":");
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

function toTimeValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function DeleteLessonButton({ lessonId, onDeleted }: { lessonId: string; onDeleted: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm("למחוק את השיעור?")) return;
    startTransition(async () => {
      const result = await deleteLessonAction(lessonId);
      if (result.error) {
        setError(result.error);
      } else {
        onDeleted();
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-red-300 px-4 py-2 font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        <Trash2 className="h-4 w-4" />
        {isPending ? "מוחקת שיעור…" : "מחק שיעור"}
      </button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function LessonFormModal({
  lesson,
  weekOffset = 0,
  trigger,
}: {
  lesson?: LessonData;
  weekOffset?: number;
  trigger: (open: () => void) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isEdit = Boolean(lesson);

  const referenceDate = useMemo(() => {
    if (lesson) return lesson.startsAt;
    const today = new Date();
    today.setDate(today.getDate() + weekOffset * 7);
    return today;
  }, [lesson, weekOffset]);

  const weekdays = useMemo(() => getWeekdaysFor(referenceDate), [referenceDate]);

  const todayMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const defaultDayIndex = useMemo(() => {
    const idx = weekdays.findIndex((d) => d.toDateString() === referenceDate.toDateString());
    return idx >= 0 ? idx : 0;
  }, [weekdays, referenceDate]);

  const [selectedDayIndex, setSelectedDayIndex] = useState(defaultDayIndex);
  const [time, setTime] = useState(() => (lesson ? toTimeValue(lesson.startsAt) : "18:00"));
  const formRef = useRef<HTMLFormElement>(null);

  const submitAction = isEdit
    ? (prevState: LessonActionState, formData: FormData) => updateLessonAction(lesson!.id, prevState, formData)
    : createLessonAction;

  const [state, formAction] = useActionState(async (prevState: LessonActionState, formData: FormData) => {
    const result = await submitAction(prevState, formData);
    if (!result.error) {
      setIsOpen(false);
      if (!isEdit) {
        formRef.current?.reset();
        setSelectedDayIndex(defaultDayIndex);
        setTime("18:00");
      }
    }
    return result;
  }, initialState);

  return (
    <>
      {trigger(() => setIsOpen(true))}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-4 text-lg font-semibold">{isEdit ? "עריכת שיעור" : "יצירת שיעור"}</h2>
            <form ref={formRef} action={formAction} className="flex flex-col gap-4">
              <input
                type="hidden"
                name="startsAt"
                value={toLocalDateTimeValue(weekdays[selectedDayIndex], time)}
              />

              <div className="flex flex-col gap-1">
                <label htmlFor="title" className="text-sm font-medium">
                  כותרת השיעור
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  defaultValue={lesson?.title}
                  className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">יום בשבוע</span>
                <div className="grid grid-cols-4 gap-2">
                  {weekdays.map((day, i) => {
                    const isPastDay = !isEdit && day < todayMidnight;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={isPastDay}
                        onClick={() => setSelectedDayIndex(i)}
                        className={`flex flex-col items-center rounded-md border px-2 py-2 text-sm ${
                          isPastDay
                            ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600"
                            : selectedDayIndex === i
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                        }`}
                      >
                        <span>יום {DAY_LETTERS[i]}</span>
                        <span className="text-xs">
                          {day.getDate()}.{day.getMonth() + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="time" className="text-sm font-medium">
                    שעת התחלה
                  </label>
                  <input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                    className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="duration" className="text-sm font-medium">
                    משך
                  </label>
                  <select
                    id="duration"
                    name="duration"
                    defaultValue={lesson?.durationMinutes ?? 60}
                    className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {DURATION_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} דקות
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="capacity" className="text-sm font-medium">
                  מספר מקומות מקסימלי
                </label>
                <input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min={1}
                  required
                  defaultValue={lesson?.capacity}
                  className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="comment" className="text-sm font-medium">
                  הערה (אופציונלי)
                </label>
                <textarea
                  id="comment"
                  name="comment"
                  rows={2}
                  defaultValue={lesson?.comment ?? ""}
                  className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              {state.error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {state.error}
                </p>
              )}

              <div className="flex gap-3">
                <SubmitButton
                  label={isEdit ? "שמירת שינויים" : "יצירת שיעור"}
                  pendingLabel={isEdit ? "שומרת…" : "יוצרת שיעור…"}
                />
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  ביטול
                </button>
              </div>
            </form>

            {isEdit && (
              <div className="mt-3">
                <DeleteLessonButton lessonId={lesson!.id} onDeleted={() => setIsOpen(false)} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function CreateLessonButton({ weekOffset = 0 }: { weekOffset?: number }) {
  return (
    <LessonFormModal
      weekOffset={weekOffset}
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="w-full rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          + הוספת שיעור
        </button>
      )}
    />
  );
}
