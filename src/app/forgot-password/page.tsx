import { redirect } from "next/navigation";
import { getCurrentTeacher } from "@/lib/auth";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const teacher = await getCurrentTeacher();
  if (teacher) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="mb-6 text-2xl font-semibold">שחזור סיסמה</h1>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
