"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  requestPasswordResetAction,
  verifyPasswordResetCodeAction,
  type RequestResetState,
  type VerifyResetState,
} from "@/app/actions/passwordReset";

const requestInitialState: RequestResetState = {};
const verifyInitialState: VerifyResetState = {};

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-zinc-900 px-4 py-2 text-white font-medium hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ForgotPasswordForm() {
  const [requestState, requestAction] = useActionState(requestPasswordResetAction, requestInitialState);
  const [verifyState, verifyAction] = useActionState(verifyPasswordResetCodeAction, verifyInitialState);

  if (requestState.status === "contact_admin") {
    return <p className="text-sm text-zinc-700 dark:text-zinc-300">יש לפנות למנהל המערכת.</p>;
  }

  if (requestState.status === "sent" && requestState.teacherId) {
    return (
      <form action={verifyAction} className="flex flex-col gap-4">
        <input type="hidden" name="teacherId" value={requestState.teacherId} />
        <div className="flex flex-col gap-1">
          <label htmlFor="code" className="text-sm font-medium">
            קוד נשלח אלייך בוואטסאפ
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            required
            autoComplete="one-time-code"
            className="rounded-md border border-zinc-300 px-3 py-2 text-center text-lg tracking-widest dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        {verifyState.error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {verifyState.error}
          </p>
        )}
        <SubmitButton label="התחברות" pendingLabel="בודקת…" />
      </form>
    );
  }

  return (
    <form action={requestAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          אימייל
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm font-medium">
          מספר טלפון
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="050-1234567"
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {requestState.error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {requestState.error}
        </p>
      )}
      <SubmitButton label="שליחת קוד" pendingLabel="שולחת…" />
      <Link href="/login" className="text-center text-sm text-zinc-600 underline dark:text-zinc-400">
        חזרה להתחברות
      </Link>
    </form>
  );
}
