"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Trash2 } from "lucide-react";
import {
  createLessonAction,
  updateLessonAction,
  deleteLessonAction,
  type LessonActionState,
} from "@/app/actions/lessons";
import {
  teacherCancelRegistrationAction,
  manualRegisterStudentAction,
  sendLessonReminderAction,
} from "@/app/actions/registrations";
import { formatIsraeliPhone } from "@/lib/phone";
import type { RosterEntry, StudentOption } from "./lesson-row";

const initialState: LessonActionState = {};

const DAY_LETTERS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const DURATION_OPTIONS = [45, 60, 75, 90];

export type LessonData = {
  id: string;
  startsAt: Date;
  durationMinutes: number;
  capacity: number;
  comment: string | null;
};

const lessonDetailFormatter = new Intl.DateTimeFormat("he-IL", {
  weekday: "long",
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

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.trim() || "?";
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
  const [isConfirming, setIsConfirming] = useState(false);

  function handleConfirmDelete() {
    startTransition(async () => {
      const result = await deleteLessonAction(lessonId);
      if (result.error) {
        setError(result.error);
        setIsConfirming(false);
      } else {
        onDeleted();
      }
    });
  }

  if (isConfirming) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-red-300 p-3 dark:border-red-900">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">
          למחוק את השיעור? לא ניתן לשחזר.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConfirmDelete}
            disabled={isPending}
            className="flex-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "מוחקת…" : "כן, מחק"}
          </button>
          <button
            type="button"
            onClick={() => setIsConfirming(false)}
            disabled={isPending}
            className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            ביטול
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsConfirming(true)}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-red-300 px-4 py-2 font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
    >
      <Trash2 className="h-4 w-4" />
      מחק שיעור
    </button>
  );
}

function CancelRegistrationButton({ registrationId }: { registrationId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    startTransition(async () => {
      const result = await teacherCancelRegistrationAction(registrationId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="shrink-0 rounded-md border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        {isPending ? "מבטלת…" : "בטל רישום"}
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Same visual treatment as the "יתרה" badge on the students list (student-row.tsx),
// just swapping blue for red when there's nothing left to spend.
function CreditBalanceBadge({ credits }: { credits: number }) {
  const isLow = credits <= 0;
  return (
    <div
      className={`flex shrink-0 flex-col items-center rounded-md px-3 py-1.5 ${
        isLow
          ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      }`}
    >
      <span className="text-xs font-medium">יתרה</span>
      <span className="text-sm font-semibold">{credits}</span>
    </div>
  );
}

function RosterStudentRow({ entry, position }: { entry: RosterEntry; position?: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            entry.status === "registered"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          {getInitials(entry.student.firstName, entry.student.lastName)}
        </div>
        {position !== undefined && <span className="text-sm text-zinc-500 dark:text-zinc-400">{position}</span>}
        <div>
          <div className="text-sm font-medium">
            {entry.student.firstName} {entry.student.lastName}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatIsraeliPhone(entry.student.phone)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <CreditBalanceBadge credits={entry.student.credits} />
        <CancelRegistrationButton registrationId={entry.registrationId} />
      </div>
    </div>
  );
}

function AddStudentToLesson({
  lessonId,
  eligibleStudents,
}: {
  lessonId: string;
  eligibleStudents: StudentOption[];
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedId, setSelectedId] = useState(eligibleStudents[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    if (!selectedId) return;
    startTransition(async () => {
      const result = await manualRegisterStudentAction(lessonId, selectedId);
      if (result.error) {
        setError(result.error);
      } else {
        setIsAdding(false);
        setError(null);
      }
    });
  }

  if (!isAdding) {
    return (
      <button
        type="button"
        onClick={() => setIsAdding(true)}
        disabled={eligibleStudents.length === 0}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        + רישום תלמידה לשיעור
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      >
        {eligibleStudents.map((student) => (
          <option key={student.id} value={student.id}>
            {student.firstName} {student.lastName}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending}
          className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "מוסיפה…" : "הוספה"}
        </button>
        <button
          type="button"
          onClick={() => setIsAdding(false)}
          disabled={isPending}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}

function SendReminderButton({ lessonId, registeredCount }: { lessonId: string; registeredCount: number }) {
  const [isPending, startTransition] = useTransition();
  const [isConfirming, setIsConfirming] = useState(false);
  const [result, setResult] = useState<{ sentCount: number; failedNames?: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const response = await sendLessonReminderAction(lessonId);
      if (response.error) {
        setError(response.error);
      } else {
        setResult({ sentCount: response.sentCount ?? 0, failedNames: response.failedNames });
        setIsConfirming(false);
      }
    });
  }

  if (registeredCount === 0) return null;

  if (result) {
    return (
      <div className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
        <p>
          נשלחה תזכורת ל-{result.sentCount} מתוך {registeredCount} תלמידות.
        </p>
        {result.failedNames && result.failedNames.length > 0 && (
          <p className="mt-1 text-red-600 dark:text-red-400">נכשל עבור: {result.failedNames.join(", ")}</p>
        )}
      </div>
    );
  }

  if (isConfirming) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-zinc-300 p-3 dark:border-zinc-700">
        <p className="text-sm font-medium">לשלוח תזכורת ל-{registeredCount} תלמידות?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending}
            className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "שולחת…" : "כן, שליחה"}
          </button>
          <button
            type="button"
            onClick={() => setIsConfirming(false)}
            disabled={isPending}
            className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            ביטול
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsConfirming(true)}
      className="w-full rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
    >
      שליחת תזכורת
    </button>
  );
}

function RosterView({
  lesson,
  roster,
  allStudents,
  onEdit,
  onClose,
}: {
  lesson: LessonData;
  roster: RosterEntry[];
  allStudents: StudentOption[];
  onEdit: () => void;
  onClose: () => void;
}) {
  const registered = roster.filter((entry) => entry.status === "registered");
  const waitlisted = roster.filter((entry) => entry.status === "waitlisted");
  const rosterStudentIds = new Set(roster.map((entry) => entry.student.id));
  const eligibleStudents = allStudents.filter((student) => !rosterStudentIds.has(student.id));

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div className="text-right">
          <div className="text-lg font-semibold">
            {lessonDetailFormatter.format(lesson.startsAt)} · {timeFormatter.format(lesson.startsAt)}
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">{lesson.durationMinutes} דקות</div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <Pencil className="h-4 w-4" />
          עריכת שיעור
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-md bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
        <span className="text-sm font-medium">נרשמו</span>
        <span>
          <span className="text-2xl font-bold">{registered.length}</span>{" "}
          <span className="text-sm text-zinc-500 dark:text-zinc-400">מתוך {lesson.capacity}</span>
        </span>
      </div>

      <div className="flex max-h-80 flex-col gap-4 overflow-y-auto">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">רשומות ({registered.length})</h3>
          {registered.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">אין עדיין תלמידות רשומות.</p>
          )}
          {registered.map((entry) => (
            <RosterStudentRow key={entry.registrationId} entry={entry} />
          ))}
        </div>

        {waitlisted.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">רשימת המתנה ({waitlisted.length})</h3>
            {waitlisted.map((entry, index) => (
              <RosterStudentRow key={entry.registrationId} entry={entry} position={index + 1} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <AddStudentToLesson lessonId={lesson.id} eligibleStudents={eligibleStudents} />
        <SendReminderButton lessonId={lesson.id} registeredCount={registered.length} />
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}

export function LessonFormModal({
  lesson,
  weekOffset = 0,
  roster = [],
  allStudents = [],
  defaultCapacity = 10,
  defaultDuration = 60,
  trigger,
}: {
  lesson?: LessonData;
  weekOffset?: number;
  roster?: RosterEntry[];
  allStudents?: StudentOption[];
  defaultCapacity?: number;
  defaultDuration?: number;
  trigger: (open: () => void) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"edit" | "roster">("edit");
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

  const effectiveDuration = lesson?.durationMinutes ?? defaultDuration;
  const durationOptions = useMemo(() => {
    const options = new Set(DURATION_OPTIONS);
    options.add(effectiveDuration);
    return Array.from(options).sort((a, b) => a - b);
  }, [effectiveDuration]);

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

  function openModal() {
    setView(roster.length > 0 ? "roster" : "edit");
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
  }

  return (
    <>
      {trigger(openModal)}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            {view === "roster" && lesson ? (
              <RosterView
                lesson={lesson}
                roster={roster}
                allStudents={allStudents}
                onEdit={() => setView("edit")}
                onClose={closeModal}
              />
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{isEdit ? "עריכת שיעור" : "יצירת שיעור"}</h2>
                  {isEdit && (
                    <button
                      type="button"
                      onClick={() => setView("roster")}
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      תלמידות
                    </button>
                  )}
                </div>
                <form ref={formRef} action={formAction} className="flex flex-col gap-4">
                  <input
                    type="hidden"
                    name="startsAt"
                    value={toLocalDateTimeValue(weekdays[selectedDayIndex], time)}
                  />

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
                        defaultValue={effectiveDuration}
                        className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        {durationOptions.map((minutes) => (
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
                      defaultValue={lesson?.capacity ?? defaultCapacity}
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
                      onClick={closeModal}
                      className="flex-1 rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      ביטול
                    </button>
                  </div>
                </form>

                {isEdit && (
                  <div className="mt-3">
                    <DeleteLessonButton lessonId={lesson!.id} onDeleted={closeModal} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function CreateLessonButton({
  weekOffset = 0,
  defaultCapacity,
  defaultDuration,
}: {
  weekOffset?: number;
  defaultCapacity?: number;
  defaultDuration?: number;
}) {
  return (
    <LessonFormModal
      weekOffset={weekOffset}
      defaultCapacity={defaultCapacity}
      defaultDuration={defaultDuration}
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
