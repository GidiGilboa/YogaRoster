"use client";

import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { copyPreviousWeekAction, type CopyWeekActionState } from "@/app/actions/lessons";

export function CopyPreviousWeekButton({ weekOffset }: { weekOffset: number }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<CopyWeekActionState | null>(null);

  function handleClick() {
    setFeedback(null);
    startTransition(async () => {
      const result = await copyPreviousWeekAction(weekOffset);
      setFeedback(result);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        <Copy className="h-3.5 w-3.5" />
        {isPending ? "מעתיקה…" : "העתק משבוע קודם"}
      </button>
      {feedback && (
        <p
          className={`text-xs ${
            feedback.status === "success"
              ? "text-green-600 dark:text-green-400"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
          role="status"
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
