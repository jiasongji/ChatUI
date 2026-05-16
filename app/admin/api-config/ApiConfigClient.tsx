"use client";

import { useEffect, useState } from "react";

type ConfigRow = {
  key: string;
  value: string;
  label: string;
};

const SENSITIVE_KEYS = ["openai_api_key"];

export function ApiConfigClient() {
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; elapsed?: number; models?: string[]; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/admin/api-config", { cache: "no-store" });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error?.message || "加载失败");
      setConfigs(json.data.configs);
      const map: Record<string, string> = {};
      for (const c of json.data.configs) {
        map[c.key] = c.value;
      }
      setEdits(map);
      setInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  async function save() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const changedConfigs = configs.map((c) => ({
        key: c.key,
        value: edits[c.key] ?? c.value
      }));
      const res = await fetch("/api/admin/api-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: changedConfigs })
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error?.message || "保存失败");
      setNotice("配置已保存，即时生效");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const apiKey = edits["openai_api_key"] || "";
      const baseUrl = edits["openai_base_url"] || "";
      if (!apiKey || !baseUrl) {
        setError("API Key 和 Base URL 不能为空");
        return;
      }
      const res = await fetch("/api/admin/api-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, baseUrl }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error?.message || "测试失败");
      setTestResult(json.data);
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : "测试失败" });
    } finally {
      setTesting(false);
    }
  }

  function maskValue(key: string, value: string): string {
    if (SENSITIVE_KEYS.includes(key) && value.length > 8) {
      return value.slice(0, 4) + "****" + value.slice(-4);
    }
    return value;
  }

  if (!initialized) {
    return (
      <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-8 text-center text-sm text-surface-400">
        加载中...
      </div>
    );
  }

  const inputClass =
    "w-full rounded-md border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-700 px-3 py-2 text-sm text-surface-800 dark:text-surface-100 font-mono focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none";

  return (
    <section className="space-y-4">
      {/* messages */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 px-3 py-2 text-sm text-brand-700 dark:text-brand-300">
          {notice}
        </div>
      )}

      {/* config form */}
      <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-4 space-y-4">
        {configs.map((c) => (
          <div key={c.key}>
            <label className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-200">
              {c.label}
            </label>
            <input
              className={inputClass}
              type={SENSITIVE_KEYS.includes(c.key) ? "password" : "text"}
              value={edits[c.key] ?? ""}
              onChange={(e) =>
                setEdits((prev) => ({ ...prev, [c.key]: e.target.value }))
              }
              placeholder={c.label}
            />
            {SENSITIVE_KEYS.includes(c.key) && c.value && (
              <p className="mt-1 text-xs text-surface-400">
                当前值: {maskValue(c.key, c.value)}
              </p>
            )}
          </div>
        ))}

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => void save()}
            disabled={loading}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {loading ? "保存中..." : "保存配置"}
          </button>
          <button
            onClick={() => void testConnection()}
            disabled={testing}
            className="rounded-md border border-brand-500 text-brand-500 px-4 py-2 text-sm font-medium hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50 transition-colors"
          >
            {testing ? "测试中..." : "测试连接"}
          </button>
          <button
            onClick={() => void load()}
            className="rounded-md border border-surface-200 dark:border-surface-700 px-4 py-2 text-sm text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
          >
            重置
          </button>
        </div>

        {testResult && (
          <div className={`rounded-lg border px-3 py-2.5 text-sm ${
            testResult.success
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
          }`}>
            {testResult.success ? (
              <div className="space-y-1">
                <p className="font-medium">
                  连接成功 ({testResult.elapsed}ms)
                  {testResult.models && testResult.models.length > 0 && (
                    <>，可用模型: {testResult.models.join(", ")}</>
                  )}
                </p>
              </div>
            ) : (
              <p className="font-medium">连接失败: {testResult.error}</p>
            )}
          </div>
        )}
      </div>

      {/* info */}
      <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 p-4 text-xs text-surface-500 space-y-1">
        <p>配置说明：</p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>API Key — 模型接口的认证密钥</li>
          <li>API Base URL — 模型接口地址，Docker 内使用服务名访问（如 cliproxyapi:8317/v1）</li>
          <li>模型列表 — 逗号分隔，控制前端可选的模型</li>
          <li>默认模型 — 新会话使用的模型，必须在允许列表中</li>
        </ul>
      </div>
    </section>
  );
}
