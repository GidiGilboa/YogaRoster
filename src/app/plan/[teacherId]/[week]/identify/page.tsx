import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { IdentifyForm } from "./identify-form";

export default async function IdentifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ teacherId: string; week: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { teacherId, week } = await params;
  const { returnTo } = await searchParams;

  const teacher = await db.teacher.findUnique({ where: { id: teacherId } });
  if (!teacher) notFound();

  const backgroundStyle: React.CSSProperties | undefined = teacher.backgroundImageUrl
    ? {
        backgroundImage: `url(${teacher.backgroundImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }
    : undefined;

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black" style={backgroundStyle}>
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="mb-2 text-2xl font-semibold">שיעורי יוגה עם {teacher.name}</h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          כדי לצפות בשיעורי השבוע, נא להזין שם וטלפון.
        </p>
        <IdentifyForm teacherId={teacherId} returnTo={returnTo ?? `/plan/${teacherId}/${week}`} />
      </div>
    </main>
  );
}
