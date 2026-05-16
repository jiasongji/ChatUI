"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/admin/users", label: "用户管理", icon: UsersIcon },
  { href: "/admin/invite-codes", label: "邀请码管理", icon: KeyIcon },
  { href: "/admin/api-config", label: "API 接口管理", icon: ApiIcon }
];

export function AdminLayout({
  username,
  children
}: {
  username: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-dvh bg-white dark:bg-surface-800">
      {/* mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col bg-surface-50 dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700 transition-transform duration-200 md:static md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* sidebar header */}
        <div className="flex items-center gap-2 border-b border-surface-200 dark:border-surface-700 p-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
            {username.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-surface-700 dark:text-surface-200">
              {username}
            </p>
            <p className="text-xs text-surface-400">管理面板</p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 md:hidden"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
                    : "text-surface-600 dark:text-surface-300 hover:bg-surface-200/60 dark:hover:bg-surface-700/50"
                }`}
              >
                <item.icon active={active} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* sidebar footer */}
        <div className="border-t border-surface-200 dark:border-surface-700 p-3">
          <Link
            href="/chat"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-surface-500 dark:text-surface-400 hover:bg-surface-200/60 dark:hover:bg-surface-700/50 transition-colors"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回聊天
          </Link>
        </div>
      </aside>

      {/* main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile header */}
        <header className="flex items-center gap-3 border-b border-surface-200 dark:border-surface-700 px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg p-2 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-medium text-surface-700 dark:text-surface-200">
            管理面板
          </span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      className={active ? "text-brand-500" : ""}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function KeyIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      className={active ? "text-brand-500" : ""}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}

function ApiIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      className={active ? "text-brand-500" : ""}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
