import { requireAdmin } from "@/lib/adminAuth";
import { adminLogoutAction } from "@/app/actions/admin";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <span className="font-semibold">ניהול מערכת</span>
        <form action={adminLogoutAction}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            התנתקות
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
