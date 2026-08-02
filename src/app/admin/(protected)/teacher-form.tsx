"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  adminUpdateTeacherAction,
  adminSetTeacherDisabledAction,
  adminSetTeacherPasswordAction,
  type AdminTeacherActionState,
} from "@/app/actions/admin";
import { formatIsraeliPhone } from "@/lib/phone";

const initialState: AdminTeacherActionState = {};

export type AdminTeacherData = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  appName: string;
  defaultLessonCapacity: number;
  defaultLessonDuration: number;
  isDisabled: boolean;
  createdAt: Date;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? "שומרת…" : "שמירת שינויים"}
    </button>
  );
}

function DisableToggle({ teacher }: { teacher: AdminTeacherData }) {
  const [isPending, startTransition] = useTransition();
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    startTransition(async () => {
      const result = await adminSetTeacherDisabledAction(teacher.id, !teacher.isDisabled);
      if (result.error) {
        setError(result.error);
      } else {
        setIsConfirming(false);
      }
    });
  }

  if (teacher.isDisabled) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className="w-full rounded-md border border-green-300 px-4 py-2 font-medium text-green-700 hover:bg-green-50 disabled:opacity-50 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-950"
      >
        {isPending ? "מפעילה…" : "הפעלת חשבון מחדש"}
      </button>
    );
  }

  if (isConfirming) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-red-300 p-3 dark:border-red-900">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">
          להשבית את חשבון המורה? היא לא תוכל להתחבר יותר.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            className="flex-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "משביתה…" : "כן, השבתה"}
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
      className="w-full rounded-md border border-red-300 px-4 py-2 font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
    >
      השבתת חשבון
    </button>
  );
}

function SetPasswordSection({ teacher }: { teacher: AdminTeacherData }) {
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"closed" | "open" | "done">("closed");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("password", password);
    startTransition(async () => {
      const result = await adminSetTeacherPasswordAction(teacher.id, {}, fd);
      if (result.error) {
        setError(result.error);
      } else {
        setPassword("");
        setMode("done");
      }
    });
  }

  if (mode === "closed") {
    return (
      <button
        type="button"
        onClick={() => setMode("open")}
        className="w-full rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        קביעת סיסמה חדשה
      </button>
    );
  }

  if (mode === "done") {
    return (
      <div className="flex items-center justify-between rounded-md border border-green-300 px-4 py-2 text-sm font-medium text-green-700 dark:border-green-900 dark:text-green-400">
        <span>הסיסמה עודכנה</span>
        <button type="button" onClick={() => setMode("closed")} className="text-xs underline">
          סגירה
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor={`new-password-${teacher.id}`} className="text-sm font-medium">
        סיסמה חדשה
      </label>
      <input
        id={`new-password-${teacher.id}`}
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="לפחות 8 תווים"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "שומרת…" : "שמירת סיסמה"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("closed");
            setPassword("");
            setError(null);
          }}
          disabled={isPending}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}

export function AdminTeacherFormModal({
  teacher,
  trigger,
}: {
  teacher: AdminTeacherData;
  trigger: (open: () => void) => React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const [state, formAction] = useActionState(async (prevState: AdminTeacherActionState, formData: FormData) => {
    const result = await adminUpdateTeacherAction(teacher.id, prevState, formData);
    if (!result.error) {
      setIsOpen(false);
    }
    return result;
  }, initialState);

  return (
    <>
      {trigger(() => setIsOpen(true))}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
          <div className="w-full max-w-sm overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 max-h-[90vh]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{teacher.name}</h2>
              {teacher.isDisabled && (
                <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                  מושבת
                </span>
              )}
            </div>

            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="name" className="text-sm font-medium">
                  שם המורה
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  defaultValue={teacher.name}
                  className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="phone" className="text-sm font-medium">
                  טלפון (אופציונלי)
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={teacher.phone ? formatIsraeliPhone(teacher.phone) : ""}
                  className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="email" className="text-sm font-medium">
                  אימייל
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  defaultValue={teacher.email}
                  className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="appName" className="text-sm font-medium">
                  שם האפליקציה
                </label>
                <input
                  id="appName"
                  name="appName"
                  type="text"
                  required
                  defaultValue={teacher.appName}
                  className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="defaultLessonCapacity" className="text-sm font-medium">
                    מקומות ברירת מחדל
                  </label>
                  <input
                    id="defaultLessonCapacity"
                    name="defaultLessonCapacity"
                    type="number"
                    min={1}
                    required
                    defaultValue={teacher.defaultLessonCapacity}
                    className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="defaultLessonDuration" className="text-sm font-medium">
                    משך ברירת מחדל (דק׳)
                  </label>
                  <input
                    id="defaultLessonDuration"
                    name="defaultLessonDuration"
                    type="number"
                    min={1}
                    required
                    defaultValue={teacher.defaultLessonDuration}
                    className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
              </div>

              {state.error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {state.error}
                </p>
              )}

              <div className="flex gap-3">
                <SubmitButton />
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 rounded-md border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  ביטול
                </button>
              </div>
            </form>

            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <SetPasswordSection teacher={teacher} />
            </div>

            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <DisableToggle teacher={teacher} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
