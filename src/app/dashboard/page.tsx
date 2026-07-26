import { requireTeacher } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  const teacher = await requireTeacher();
  const students = await db.student.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <span className="font-semibold">Yoga Roster</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">{teacher.name}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              התנתקות
            </button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="mb-4 text-xl font-semibold">התלמידים שלך</h1>
          <ul className="flex flex-col gap-2">
            {students.map((student) => (
              <li
                key={student.id}
                className="rounded-md border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                {student.firstName} {student.lastName}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
