import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { CreateStudentButton } from "./student-form";
import { StudentRow } from "./student-row";

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
        <ul className="mb-6 flex flex-col gap-2">
          {students.length === 0 && (
            <li className="text-sm text-zinc-500 dark:text-zinc-400">עדיין אין תלמידות ברשימה.</li>
          )}
          {students.map((student) => (
            <StudentRow key={student.id} student={student} />
          ))}
        </ul>
        <CreateStudentButton />
      </div>
    </main>
  );
}
