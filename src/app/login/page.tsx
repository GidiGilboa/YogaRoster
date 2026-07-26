import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentTeacher } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const teacher = await getCurrentTeacher();
  if (teacher) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="mb-6 text-2xl font-semibold">התחברות</h1>
        <LoginForm />
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          אין לך חשבון?{" "}
          <Link href="/signup" className="font-medium text-zinc-900 underline dark:text-zinc-50">
            יצירת חשבון
          </Link>
        </p>
      </div>
    </div>
  );
}
