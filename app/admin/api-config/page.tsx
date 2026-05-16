import { ApiConfigClient } from "./ApiConfigClient";

export const dynamic = "force-dynamic";

export default async function ApiConfigPage() {
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-surface-900 dark:text-white">
          API 接口管理
        </h1>
        <p className="mt-1 text-sm text-surface-500">
          管理 AI 模型接口的连接配置，修改后即时生效
        </p>
      </div>
      <ApiConfigClient />
    </div>
  );
}
