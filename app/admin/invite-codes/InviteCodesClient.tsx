"use client";

import { useEffect, useState } from "react";

type InviteCodeRow = {
  id: string;
  code: string;
  label: string | null;
  usedById: string | null;
  usedAt: string | null;
  createdAt: string;
  createdBy: { username: string };
  usedBy: { username: string } | null;
};

export function InviteCodesClient() {
  const [codes, setCodes] = useState<InviteCodeRow[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function parseResponse(response: Response) {
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.ok) {
      throw new Error(json?.error?.message || "请求失败，请稍后重试");
    }
    return json.data;
  }

  async function refresh() {
    setError("");
    try {
      const data = await parseResponse(
        await fetch("/api/admin/invite-codes", { cache: "no-store" })
      );
      setCodes(data.inviteCodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  async function generate() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCode(result);
  }

  async function create() {
    if (!newCode.trim()) {
      setError("请输入或生成邀请码");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await parseResponse(
        await fetch("/api/admin/invite-codes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: newCode.trim(),
            label: newLabel.trim() || undefined
          })
        })
      );
      setNewCode("");
      setNewLabel("");
      setNotice("邀请码已创建");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("删除该邀请码？")) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await parseResponse(
        await fetch(`/api/admin/invite-codes/${id}`, {
          method: "DELETE"
        })
      );
      setNotice("邀请码已删除");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setLoading(false);
    }
  }

  function beginEdit(row: InviteCodeRow) {
    setEditingId(row.id);
    setEditCode(row.code);
    setEditLabel(row.label || "");
  }

  async function saveEdit(id: string) {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await parseResponse(
        await fetch(`/api/admin/invite-codes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: editCode.trim(),
            label: editLabel.trim() || undefined
          })
        })
      );
      setEditingId(null);
      setNotice("邀请码已更新");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "rounded-md border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-700 px-2 py-1 text-sm text-surface-800 dark:text-surface-100 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none";
  const btnClass =
    "rounded-md px-3 py-1 text-sm transition-colors disabled:opacity-50";
  const btnPrimary = `${btnClass} bg-brand-500 text-white hover:bg-brand-600`;
  const btnSecondary = `${btnClass} border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700`;
  const btnDanger = `${btnClass} border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`;

  return (
    <section className="space-y-4">
      {/* create form */}
      <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-4">
        <h3 className="text-sm font-medium text-surface-700 dark:text-surface-200 mb-3">
          创建邀请码
        </h3>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[120px]">
            <label className="mb-1 block text-xs text-surface-500">邀请码</label>
            <div className="flex gap-2">
              <input
                className={inputClass + " flex-1"}
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="输入或点击生成"
              />
              <button
                type="button"
                className={btnSecondary}
                onClick={() => void generate()}
              >
                随机生成
              </button>
            </div>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="mb-1 block text-xs text-surface-500">备注（可选）</label>
            <input
              className={inputClass + " w-full"}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="如：张三专用"
            />
          </div>
          <button
            className={btnPrimary}
            disabled={loading || !newCode.trim()}
            onClick={() => void create()}
          >
            创建
          </button>
        </div>
      </div>

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

      {/* table */}
      <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-surface-50 dark:bg-surface-800 text-left text-surface-500 dark:text-surface-400">
              <tr>
                <th className="border-b border-surface-200 dark:border-surface-700 px-4 py-3 font-medium">
                  邀请码
                </th>
                <th className="border-b border-surface-200 dark:border-surface-700 px-4 py-3 font-medium">
                  备注
                </th>
                <th className="border-b border-surface-200 dark:border-surface-700 px-4 py-3 font-medium">
                  状态
                </th>
                <th className="border-b border-surface-200 dark:border-surface-700 px-4 py-3 font-medium">
                  使用者
                </th>
                <th className="border-b border-surface-200 dark:border-surface-700 px-4 py-3 font-medium">
                  创建时间
                </th>
                <th className="border-b border-surface-200 dark:border-surface-700 px-4 py-3 font-medium">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-surface-400"
                  >
                    暂无邀请码
                  </td>
                </tr>
              ) : (
                codes.map((c) => (
                  <tr
                    className="text-surface-700 dark:text-surface-200"
                    key={c.id}
                  >
                    <td className="border-b border-surface-100 dark:border-surface-700 px-4 py-3">
                      {editingId === c.id ? (
                        <input
                          className={inputClass}
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value)}
                        />
                      ) : (
                        <code className="rounded bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 text-xs font-mono">
                          {c.code}
                        </code>
                      )}
                    </td>
                    <td className="border-b border-surface-100 dark:border-surface-700 px-4 py-3">
                      {editingId === c.id ? (
                        <input
                          className={inputClass}
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          placeholder="备注"
                        />
                      ) : (
                        c.label || "-"
                      )}
                    </td>
                    <td className="border-b border-surface-100 dark:border-surface-700 px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.usedById
                            ? "bg-surface-100 dark:bg-surface-700 text-surface-500"
                            : "bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
                        }`}
                      >
                        {c.usedById ? "已使用" : "未使用"}
                      </span>
                    </td>
                    <td className="border-b border-surface-100 dark:border-surface-700 px-4 py-3 text-surface-400">
                      {c.usedBy?.username || "-"}
                    </td>
                    <td className="border-b border-surface-100 dark:border-surface-700 px-4 py-3 text-surface-400">
                      {new Date(c.createdAt).toLocaleString()}
                    </td>
                    <td className="border-b border-surface-100 dark:border-surface-700 px-4 py-3">
                      {editingId === c.id ? (
                        <div className="flex gap-2">
                          <button
                            className={btnPrimary}
                            disabled={loading}
                            onClick={() => void saveEdit(c.id)}
                          >
                            保存
                          </button>
                          <button
                            className={btnSecondary}
                            onClick={() => setEditingId(null)}
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            className={btnSecondary}
                            onClick={() => beginEdit(c)}
                          >
                            编辑
                          </button>
                          <button
                            className={btnDanger}
                            disabled={loading}
                            onClick={() => void remove(c.id)}
                          >
                            删除
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
