"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { publishWeekAction } from "@/app/actions/publish";
import { copyPreviousWeekAction } from "@/app/actions/lessons";

const FLASH_DURATION_MS = 2500;

export function LessonsToolbar({
  teacherId,
  weekOffset,
  weekStartParam,
  weekLabel,
  hasLessonsThisWeek,
}: {
  teacherId: string;
  weekOffset: number;
  weekStartParam: string;
  weekLabel: string;
  hasLessonsThisWeek: boolean;
}) {
  const [isPublishPending, startPublishTransition] = useTransition();
  const [publishSucceeded, setPublishSucceeded] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  const [isCopyWeekPending, startCopyWeekTransition] = useTransition();
  const [copyWeekSucceeded, setCopyWeekSucceeded] = useState(false);
  const [pastBlocked, setPastBlocked] = useState(false);
  const [isConfirmingCopy, setIsConfirmingCopy] = useState(false);

  const publishResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyWeekResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handlePublish() {
    startPublishTransition(async () => {
      const result = await publishWeekAction(weekStartParam);
      if (result.error) return;

      const url = `${window.location.origin}/plan/${teacherId}/${weekStartParam}`;
      try {
        await navigator.clipboard.writeText(url);
        setManualUrl(null);
        setPublishSucceeded(true);
        if (publishResetRef.current) clearTimeout(publishResetRef.current);
        publishResetRef.current = setTimeout(() => setPublishSucceeded(false), FLASH_DURATION_MS);
      } catch {
        setManualUrl(url);
      }
    });
  }

  function handleCopyWeek() {
    setIsConfirmingCopy(false);
    startCopyWeekTransition(async () => {
      const result = await copyPreviousWeekAction(weekOffset);
      if (result.status === "past") {
        setPastBlocked(true);
        if (copyWeekResetRef.current) clearTimeout(copyWeekResetRef.current);
        copyWeekResetRef.current = setTimeout(() => setPastBlocked(false), FLASH_DURATION_MS);
        return;
      }
      if (result.status === "success") {
        setCopyWeekSucceeded(true);
        if (copyWeekResetRef.current) clearTimeout(copyWeekResetRef.current);
        copyWeekResetRef.current = setTimeout(() => setCopyWeekSucceeded(false), FLASH_DURATION_MS);
      }
    });
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-end gap-2">
        {isConfirmingCopy ? (
          <div className="flex h-9 items-center gap-2 text-sm">
            <span className="font-medium">להעתיק את שיעורי השבוע הקודם?</span>
            <button
              type="button"
              onClick={handleCopyWeek}
              disabled={isCopyWeekPending}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isCopyWeekPending ? "מעתיקה…" : "כן, העתקה"}
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmingCopy(false)}
              disabled={isCopyWeekPending}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              ביטול
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirmingCopy(true)}
            disabled={isCopyWeekPending}
            className="flex h-9 items-center gap-1.5 rounded-md border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {copyWeekSucceeded ? (
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            העתק משבוע קודם
          </button>
        )}
        {!isConfirmingCopy && (
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishPending || !hasLessonsThisWeek}
            className="flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
          {publishSucceeded ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          פרסם לקהילה
        </button>
        )}
      </div>

      {manualUrl && (
        <div className="mb-4 flex flex-col items-end gap-1">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">לא ניתן להעתיק אוטומטית, יש להעתיק ידנית:</p>
          <input
            type="text"
            readOnly
            value={manualUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="w-64 rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/dashboard/lessons?week=${weekOffset - 1}`}
          aria-label="שבוע קודם"
          className="rounded-md border border-zinc-300 p-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
        <span
          className={`text-sm font-medium transition-colors ${
            pastBlocked ? "text-red-600 dark:text-red-400" : ""
          }`}
        >
          {weekLabel}
        </span>
        <Link
          href={`/dashboard/lessons?week=${weekOffset + 1}`}
          aria-label="שבוע הבא"
          className="rounded-md border border-zinc-300 p-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
