import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentTeacher } from "@/lib/auth";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const teacher = await getCurrentTeacher();
  if (teacher) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="mb-6 text-2xl font-semibold">יצירת חשבון מורה</h1>
        <SignupForm />
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          כבר יש לך חשבון?{" "}
          <Link href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-50">
            התחברות
          </Link>
        </p>
      </div>
    </div>
  );
}
