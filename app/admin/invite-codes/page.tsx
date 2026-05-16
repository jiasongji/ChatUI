import { InviteCodesClient } from "./InviteCodesClient";

export const dynamic = "force-dynamic";

export default async function InviteCodesPage() {
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-surface-900 dark:text-white">
          邀请码管理
        </h1>
        <p className="mt-1 text-sm text-surface-500">
          生成、编辑、删除邀请码，用于控制注册
        </p>
      </div>
      <InviteCodesClient />
    </div>
  );
}
