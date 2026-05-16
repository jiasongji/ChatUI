"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type Mode = "login" | "register";

export function AuthCard({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("chatui-theme", next ? "dark" : "light");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "register"
          ? { username, email, password, inviteCode }
          : { email, password }
      )
    });
    const json = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok || !json?.ok) {
      setError(json?.error?.message || "请求失败，请稍后重试");
      return;
    }

    if (mode === "register") {
      setMessage("账号已提交审核，请等待管理员批准");
      setPassword("");
      return;
    }

    router.replace("/chat");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-700 px-4 py-2.5 text-sm text-surface-900 dark:text-white placeholder:text-surface-400 transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white dark:bg-surface-800 px-4">
      {/* theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed right-4 top-4 rounded-full p-2 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        title="切换主题"
      >
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>

      <div className="w-full max-w-[400px]">
        {/* branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500">
            <svg
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
              stroke="white"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-surface-900 dark:text-white">
            {mode === "login" ? "欢迎回来" : "创建账号"}
          </h1>
          <p className="mt-2 text-sm text-surface-400">
            {mode === "login"
              ? "登录以继续使用 ChatUI"
              : "注册以开始使用 ChatUI"}
          </p>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          {mode === "register" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-600 dark:text-surface-300">
                用户名
              </label>
              <input
                className={inputClass}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="起一个名字，至少 2 个字符"
                autoComplete="name"
                required
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-600 dark:text-surface-300">
              邮箱地址
            </label>
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-600 dark:text-surface-300">
              密码
            </label>
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "login" ? "输入你的密码" : "设置密码，至少 8 位"}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
            />
          </div>

          {mode === "register" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-600 dark:text-surface-300">
                邀请码
              </label>
              <input
                className={inputClass}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="输入管理员提供的邀请码"
                required
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 px-4 py-3 text-sm text-brand-700 dark:text-brand-300">
              {message}
            </div>
          )}

          <button
            className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            disabled={loading}
          >
            {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-surface-400">
          {mode === "login" ? "还没有账号？" : "已有账号？"}
          <Link
            className="ml-1 font-medium text-brand-500 hover:text-brand-600 transition-colors"
            href={mode === "login" ? "/register" : "/login"}
          >
            {mode === "login" ? "注册" : "登录"}
          </Link>
        </p>
      </div>
    </main>
  );
}

function SunIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}
