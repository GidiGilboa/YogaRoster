import { redirect } from "next/navigation";
import { isAdminSessionActive } from "@/lib/adminAuth";
import { AdminLoginForm } from "./login-form";

export default async function AdminLoginPage() {
  const active = await isAdminSessionActive();
  if (active) {
    redirect("/admin");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="mb-6 text-2xl font-semibold">כניסת מנהל</h1>
        <AdminLoginForm />
      </div>
    </div>
  );
}
