import { db } from "@/lib/db";
import { TeacherRow } from "./teacher-row";

export default async function AdminTeachersPage() {
  const teachers = await db.teacher.findMany({
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-md">
        <h1 className="mb-4 text-xl font-semibold">כל המורות ({teachers.length})</h1>
        <ul className="mb-6 flex flex-col gap-2">
          {teachers.length === 0 && (
            <li className="text-sm text-zinc-500 dark:text-zinc-400">אין עדיין מורות במערכת.</li>
          )}
          {teachers.map((teacher) => (
            <TeacherRow key={teacher.id} teacher={teacher} />
          ))}
        </ul>
      </div>
    </main>
  );
}
