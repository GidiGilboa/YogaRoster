import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function StudentsPage() {
  const teacher = await requireTeacher();
  const students = await db.student.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/dashboard"
          className="mb-4 inline-block text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← חזרה
        </Link>
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
  );
}
