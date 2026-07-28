"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { identifyStudentAction, type IdentifyActionState } from "@/app/actions/identify";

const initialState: IdentifyActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? "מזהה…" : "המשך"}
    </button>
  );
}

export function IdentifyForm({ teacherId, returnTo }: { teacherId: string; returnTo: string }) {
  const action = (prevState: IdentifyActionState, formData: FormData) =>
    identifyStudentAction(teacherId, returnTo, prevState, formData);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          שם מלא
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
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
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
