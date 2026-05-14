"use client";

import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  username: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    sessions: number;
    messages: number;
  };
};

type EditState = {
  username: string;
  email: string;
  role: string;
  status: string;
  password: string;
};

export function AdminUsersClient({
  currentUserId
}: {
  currentUserId: string;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [editing, setEditing] = useState<Record<string, EditState>>({});
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
    const data = await parseResponse(
      await fetch("/api/admin/users", { cache: "no-store" })
    );
    setUsers(data.users);
  }

  async function action(userId: string, kind: "approve" | "disable") {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await parseResponse(
        await fetch(`/api/admin/users/${userId}/${kind}`, {
          method: "POST"
        })
      );
      setNotice(kind === "approve" ? "已批准用户" : "已禁用用户");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  function beginEdit(user: UserRow) {
    setEditing((cur) => ({
      ...cur,
      [user.id]: {
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        password: ""
      }
    }));
  }

  async function save(userId: string) {
    const state = editing[userId];
    if (!state) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const payload: Record<string, string> = {
        username: state.username,
        email: state.email,
        role: state.role,
        status: state.status
      };
      if (state.password.trim()) {
        payload.password = state.password;
      }
      await parseResponse(
        await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      );
      setEditing((cur) => {
        const next = { ...cur };
        delete next[userId];
        return next;
      });
      setNotice("用户已更新");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }

  async function remove(userId: string) {
    if (!window.confirm("删除该用户及其全部会话和消息？")) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await parseResponse(
        await fetch(`/api/admin/users/${userId}`, {
          method: "DELETE"
        })
      );
      setNotice("用户已删除");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setLoading(false);
    }
  }

  function updateEdit(
    userId: string,
    key: keyof EditState,
    value: string
  ) {
    setEditing((cur) => ({
      ...cur,
      [userId]: { ...cur[userId], [key]: value }
    }));
  }

  const inputClass =
    "rounded-md border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-700 px-2 py-1 text-sm text-surface-800 dark:text-surface-100 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none";
  const btnClass =
    "rounded-md px-3 py-1 text-sm transition-colors disabled:opacity-50";
  const btnPrimary = `${btnClass} bg-brand-500 text-white hover:bg-brand-600`;
  const btnSecondary = `${btnClass} border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700`;
  const btnDanger = `${btnClass} border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`;

  return (
    <section className="overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-200 dark:border-surface-700 p-4">
        {error && (
          <div className="w-full rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        {notice && (
          <div className="w-full rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 px-3 py-2 text-sm text-brand-700 dark:text-brand-300">
            {notice}
          </div>
        )}
        <button
          className={btnSecondary}
          disabled={loading}
          onClick={() => void refresh()}
        >
          刷新
        </button>
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead className="bg-surface-50 dark:bg-surface-800 text-left text-surface-500 dark:text-surface-400">
            <tr>
              <th className="border-b border-surface-200 dark:border-surface-700 px-4 py-3 font-medium">
                用户名
              </th>
              <th className="border-b border-surface-200 dark:border-surface-700 px-4 py-3 font-medium">
                邮箱
              </th>
              <th className="border-b border-surface-200 dark:border-surface-700 px-4 py-3 font-medium">
                角色
              </th>
              <th className="border-b border-surface-200 dark:border-surface-700 px-4 py-3 font-medium">
                状态
              </th>
              <th className="border-b border-surface-200 dark:border-surface-700 px-4 py-3 font-medium">
                数据
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
            {users.map((u) => {
              const st = editing[u.id];
              const isSelf = u.id === currentUserId;
              return (
                <tr
                  className="text-surface-700 dark:text-surface-200"
                  key={u.id}
                >
                  <td className="border-b border-surface-100 dark:border-surface-700 px-4 py-3">
                    {st ? (
                      <input
                        className={inputClass}
                        value={st.username}
                        onChange={(e) =>
                          updateEdit(u.id, "username", e.target.value)
                        }
                      />
                    ) : (
                      u.username
                    )}
                  </td>
                  <td className="border-b border-surface-100 dark:border-surface-700 px-4 py-3">
                    {st ? (
                      <input
                        className={inputClass}
                        type="email"
                        value={st.email}
                        onChange={(e) =>
                          updateEdit(u.id, "email", e.target.value)
                        }
                      />
                    ) : (
                      u.email
                    )}
                  </td>
                  <td className="border-b border-surface-100 dark:border-surface-700 px-4 py-3">
                    {st ? (
                      <select
                        className={inputClass}
                        value={st.role}
                        onChange={(e) =>
                          updateEdit(u.id, "role", e.target.value)
                        }
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    ) : (
                      u.role
                    )}
                  </td>
                  <td className="border-b border-surface-100 dark:border-surface-700 px-4 py-3">
                    {st ? (
                      <select
                        className={inputClass}
                        value={st.status}
                        onChange={(e) =>
                          updateEdit(u.id, "status", e.target.value)
                        }
                      >
                        <option value="pending">pending</option>
                        <option value="approved">approved</option>
                        <option value="disabled">disabled</option>
                      </select>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.status === "approved"
                            ? "bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
                            : u.status === "disabled"
                              ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                              : "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {u.status}
                      </span>
                    )}
                  </td>
                  <td className="border-b border-surface-100 dark:border-surface-700 px-4 py-3 text-surface-400">
                    {u._count?.sessions ?? 0} 会话 /{" "}
                    {u._count?.messages ?? 0} 消息
                  </td>
                  <td className="border-b border-surface-100 dark:border-surface-700 px-4 py-3 text-surface-400">
                    {new Date(u.createdAt).toLocaleString()}
                  </td>
                  <td className="border-b border-surface-100 dark:border-surface-700 px-4 py-3">
                    {st ? (
                      <div className="flex flex-wrap gap-2">
                        <input
                          className={inputClass}
                          placeholder="新密码"
                          type="password"
                          value={st.password}
                          onChange={(e) =>
                            updateEdit(u.id, "password", e.target.value)
                          }
                        />
                        <button
                          className={btnPrimary}
                          disabled={loading}
                          onClick={() => void save(u.id)}
                        >
                          保存
                        </button>
                        <button
                          className={btnSecondary}
                          onClick={() =>
                            setEditing((cur) => {
                              const next = { ...cur };
                              delete next[u.id];
                              return next;
                            })
                          }
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={btnSecondary}
                          disabled={loading}
                          onClick={() => void action(u.id, "approve")}
                        >
                          批准
                        </button>
                        <button
                          className={btnSecondary}
                          disabled={loading || isSelf}
                          onClick={() => void action(u.id, "disable")}
                        >
                          禁用
                        </button>
                        <button
                          className={btnSecondary}
                          onClick={() => beginEdit(u)}
                        >
                          编辑
                        </button>
                        <button
                          className={btnDanger}
                          disabled={loading || isSelf}
                          onClick={() => void remove(u.id)}
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
