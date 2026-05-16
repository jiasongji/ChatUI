import { AdminUsersClient } from "./AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-surface-900 dark:text-white">
          用户管理
        </h1>
        <p className="mt-1 text-sm text-surface-500">
          管理注册用户，审批、编辑、禁用
        </p>
      </div>
      <AdminUsersClientWrapper />
    </div>
  );
}

async function AdminUsersClientWrapper() {
  const { getCurrentUser } = await import("@/lib/auth");
  const user = await getCurrentUser();
  if (!user) return null;
  return <AdminUsersClient currentUserId={user.id} />;
}
