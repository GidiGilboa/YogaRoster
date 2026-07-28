"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createStudentAction, updateStudentAction, type StudentActionState } from "@/app/actions/students";
import { formatIsraeliPhone } from "@/lib/phone";

const initialState: StudentActionState = {};

export type StudentData = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  credits: number;
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

export function StudentFormModal({
  student,
  trigger,
}: {
  student?: StudentData;
  trigger: (open: () => void) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <>
      {trigger(() => setIsOpen(true))}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-4 text-lg font-semibold">{isEdit ? "עריכת תלמידה" : "הוספת תלמידה"}</h2>
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
