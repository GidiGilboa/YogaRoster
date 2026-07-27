import Link from "next/link";
import { CalendarDays, Users } from "lucide-react";

export default function DashboardHomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
      <div className="grid w-full max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2">
        <Link
          href="/dashboard/lessons"
          className="flex flex-col items-center gap-4 rounded-lg border border-zinc-200 bg-white px-8 py-12 text-center shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          <CalendarDays className="h-12 w-12 text-blue-600" strokeWidth={1.5} />
          <span className="text-lg font-semibold">שיעורים</span>
        </Link>
        <Link
          href="/dashboard/students"
          className="flex flex-col items-center gap-4 rounded-lg border border-zinc-200 bg-white px-8 py-12 text-center shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          <Users className="h-12 w-12 text-blue-600" strokeWidth={1.5} />
          <span className="text-lg font-semibold">תלמידים</span>
        </Link>
      </div>
    </main>
  );
}
