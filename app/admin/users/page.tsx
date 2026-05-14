import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminUsersClient } from "./AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user || user.status === "disabled") {
    redirect("/login");
  }
  if (user.role !== "admin") {
    redirect("/chat");
  }

  return (
    <main className="min-h-dvh bg-white dark:bg-surface-800 px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-brand-500">ChatUI</p>
            <h1 className="text-2xl font-semibold text-surface-900 dark:text-white">
              用户管理
            </h1>
          </div>
          <Link
            className="rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-700 px-3 py-2 text-sm text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-600 transition-colors"
            href="/chat"
          >
            返回聊天
          </Link>
        </header>
        <AdminUsersClient currentUserId={user.id} />
      </div>
    </main>
  );
}
