"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  createStudentAction,
  updateStudentAction,
  getStudentLessonHistoryAction,
  type StudentActionState,
  type StudentLessonHistoryEntry,
} from "@/app/actions/students";
import { addStudentLinkAction, removeStudentLinkAction } from "@/app/actions/studentLinks";
import { formatIsraeliPhone } from "@/lib/phone";

const initialState: StudentActionState = {};

const lessonDateFormatter = new Intl.DateTimeFormat("he-IL", {
  weekday: "long",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export type StudentData = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  credits: number;
};

export type StudentOption = {
  id: string;
  firstName: string;
  lastName: string;
};

export type DependentLink = {
  id: string;
  dependent: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

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

function LessonHistoryView({ student, onClose }: { student: StudentData; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [entries, setEntries] = useState<StudentLessonHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const result = await getStudentLessonHistoryAction(student.id);
      if (result.error) {
        setError(result.error);
      } else {
        setEntries(result.entries ?? []);
      }
    });
  }, [student.id]);

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">
        {student.firstName} {student.lastName}
      </h2>
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">שיעורים ב-3 החודשים האחרונים</p>

      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {isPending && <p className="text-sm text-zinc-500 dark:text-zinc-400">טוענת…</p>}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {entries && entries.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">אין שיעורים ב-3 החודשים האחרונים.</p>
        )}
        {entries?.map((entry) => (
          <div
            key={entry.registrationId}
            className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
          >
            <div className="text-sm font-medium">
              {lessonDateFormatter.format(entry.lesson.startsAt)} · {entry.lesson.durationMinutes} דקות
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-4 w-full rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        ביטול
      </button>
    </div>
  );
}

function RegisterForSection({
  student,
  allStudents,
  links,
}: {
  student: StudentData;
  allStudents: StudentOption[];
  links: DependentLink[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const linkedIds = new Set(links.map((link) => link.dependent.id));
  const eligible = allStudents.filter((option) => option.id !== student.id && !linkedIds.has(option.id));
  const [selectedId, setSelectedId] = useState(eligible[0]?.id ?? "");

  function handleAdd() {
    if (!selectedId) return;
    startTransition(async () => {
      const result = await addStudentLinkAction(student.id, selectedId);
      setError(result.error ?? null);
    });
  }

  function handleRemove(linkId: string) {
    startTransition(async () => {
      const result = await removeStudentLinkAction(linkId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="text-sm font-medium">רישום עבור</span>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          תלמידות ש{student.firstName} יכולה לרשום מטעמה (למשל ילדים שלה)
        </p>
      </div>

      <div className="flex gap-2">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={eligible.length === 0}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {eligible.length === 0 ? (
            <option value="">אין תלמידות זמינות</option>
          ) : (
            eligible.map((option) => (
              <option key={option.id} value={option.id}>
                {option.firstName} {option.lastName}
              </option>
            ))
          )}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !selectedId}
          className="rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          הוספה
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {links.length > 0 && (
        <div className="flex flex-col gap-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
            >
              <span className="text-sm">
                {link.dependent.firstName} {link.dependent.lastName}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(link.id)}
                disabled={isPending}
                className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                הסרה
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StudentFormModal({
  student,
  allStudents = [],
  links = [],
  trigger,
}: {
  student?: StudentData;
  allStudents?: StudentOption[];
  links?: DependentLink[];
  trigger: (open: () => void) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"edit" | "history">("edit");
  const isEdit = Boolean(student);
  const formRef = useRef<HTMLFormElement>(null);

  const submitAction = isEdit
    ? (prevState: StudentActionState, formData: FormData) => updateStudentAction(student!.id, prevState, formData)
    : createStudentAction;

  const [state, formAction] = useActionState(async (prevState: StudentActionState, formData: FormData) => {
    const result = await submitAction(prevState, formData);
    if (!result.error) {
      setIsOpen(false);
      if (!isEdit) {
        formRef.current?.reset();
      }
    }
    return result;
  }, initialState);

  function openModal() {
    setView("edit");
    setIsOpen(true);
  }

  return (
    <>
      {trigger(openModal)}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            {view === "history" && student ? (
              <LessonHistoryView student={student} onClose={() => setView("edit")} />
            ) : (
              <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{isEdit ? "עריכת תלמידה" : "הוספת תלמידה"}</h2>
              {isEdit && (
                <button
                  type="button"
                  onClick={() => setView("history")}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  שיעורים
                </button>
              )}
            </div>
            <form ref={formRef} action={formAction} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="firstName" className="text-sm font-medium">
                    שם פרטי
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    defaultValue={student?.firstName}
                    className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="lastName" className="text-sm font-medium">
                    שם משפחה
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    defaultValue={student?.lastName}
                    className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="phone" className="text-sm font-medium">
                  טלפון
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  defaultValue={student ? formatIsraeliPhone(student.phone) : undefined}
                  className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="email" className="text-sm font-medium">
                  אימייל (אופציונלי)
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={student?.email ?? ""}
                  className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="credits" className="text-sm font-medium">
                  יתרת שיעורים
                </label>
                <input
                  id="credits"
                  name="credits"
                  type="number"
                  min={0}
                  required
                  defaultValue={student?.credits ?? 0}
                  className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              {isEdit && (
                <>
                  <div className="border-t border-zinc-200 dark:border-zinc-800" />
                  <RegisterForSection student={student!} allStudents={allStudents} links={links} />
                </>
              )}

              {state.error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {state.error}
                </p>
              )}

              <div className="flex gap-3">
                <SubmitButton
                  label={isEdit ? "שמירת שינויים" : "הוספת תלמידה"}
                  pendingLabel={isEdit ? "שומרת…" : "מוסיפה תלמידה…"}
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
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function CreateStudentButton() {
  return (
    <StudentFormModal
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="w-full rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          + הוספת תלמידה
        </button>
      )}
    />
  );
}
