"use client";

import { ChevronLeft } from "lucide-react";
import { formatIsraeliPhone } from "@/lib/phone";
import { AdminTeacherFormModal, type AdminTeacherData } from "./teacher-form";

const createdAtFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});

export function TeacherRow({ teacher }: { teacher: AdminTeacherData }) {
  return (
    <AdminTeacherFormModal
      teacher={teacher}
      trigger={(open) => (
        <li>
          <button
            type="button"
            onClick={open}
            className="flex w-full items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-4 py-3 text-right hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            <div className="min-w-0 flex-1 px-2">
              <div className="flex items-center gap-2 font-medium">
                {teacher.name}
                {teacher.isDisabled && (
                  <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                    מושבת
                  </span>
                )}
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {teacher.email}
                {teacher.phone ? ` · ${formatIsraeliPhone(teacher.phone)}` : ""}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                נרשמה ב-{createdAtFormatter.format(teacher.createdAt)}
              </div>
            </div>

            <ChevronLeft className="h-5 w-5 shrink-0 text-zinc-400" />
          </button>
        </li>
      )}
    />
  );
}
