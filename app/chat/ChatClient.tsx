"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { MarkdownMessage } from "@/components/MarkdownMessage";

type User = {
  id: string;
  email: string;
  username: string;
  role: string;
  status: string;
};

type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type Message = {
  id: string;
  role: string;
  content: string;
  model: string | null;
  type: string;
  imageUrl: string | null;
  createdAt: string;
};

const CHAT_MODELS = ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5"];
const DEFAULT_CHAT_MODEL = "gpt-5.4-mini";

const IMAGE_RATIOS = [
  { label: "1:1", size: "1024x1024", desc: "正方形" },
  { label: "4:3", size: "1536x1024", desc: "横向" },
  { label: "3:4", size: "1024x1536", desc: "纵向" },
  { label: "16:9", size: "1792x1024", desc: "宽屏" },
  { label: "9:16", size: "1024x1792", desc: "竖屏" }
];

export function ChatClient({ user }: { user: User }) {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<"chat" | "image">("chat");
  const [model, setModel] = useState(DEFAULT_CHAT_MODEL);
  const [aspectRatio, setAspectRatio] = useState("1024x1024");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const approved = user.status === "approved";

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    void refreshSessions();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("chatui-theme", next ? "dark" : "light");
  }

  async function parseResponse(response: Response) {
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.ok) {
      throw new Error(json?.error?.message || "请求失败，请稍后重试");
    }
    return json.data;
  }

  async function refreshSessions() {
    try {
      const data = await parseResponse(
        await fetch("/api/sessions", { cache: "no-store" })
      );
      setSessions(data.sessions);
      if (data.sessions[0] && !activeSessionId) {
        setActiveSessionId(data.sessions[0].id);
        await loadMessages(data.sessions[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载会话失败");
    }
  }

  async function loadMessages(sessionId: string) {
    setError("");
    const data = await parseResponse(
      await fetch(
        `/api/messages?sessionId=${encodeURIComponent(sessionId)}`,
        { cache: "no-store" }
      )
    );
    setMessages(data.messages);
  }

  async function selectSession(sessionId: string) {
    setActiveSessionId(sessionId);
    setSidebarOpen(false);
    await loadMessages(sessionId);
  }

  async function createSession() {
    setError("");
    const data = await parseResponse(
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "新会话" })
      })
    );
    setSessions((current) => [data.session, ...current]);
    setActiveSessionId(data.session.id);
    setMessages([]);
    setSidebarOpen(false);
    return data.session.id as string;
  }

  async function deleteSession(sessionId: string) {
    if (!window.confirm("删除该会话？")) return;
    setError("");
    await parseResponse(
      await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE"
      })
    );
    const next = sessions.filter((s) => s.id !== sessionId);
    setSessions(next);
    if (activeSessionId === sessionId) {
      const first = next[0];
      setActiveSessionId(first?.id || "");
      setMessages([]);
      if (first) await loadMessages(first.id);
    }
  }

  async function copyMessage(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || loading) return;
    if (!approved) {
      setError("账号已提交审核，请等待管理员批准");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const sessionId = activeSessionId || (await createSession());
      const endpoint = mode === "chat" ? "/api/chat" : "/api/images";
      const payload =
        mode === "chat"
          ? { sessionId, model, content: input }
          : { sessionId, model: "gpt-image-2", prompt: input, size: aspectRatio };

      const data = await parseResponse(
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      );

      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      if (mode === "chat") {
        setMessages((cur) => [...cur, data.userMessage, data.assistantMessage]);
      } else {
        setMessages((cur) => [...cur, data.userMessage, data.imageMessage]);
      }
      await refreshSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.closest("form")?.requestSubmit();
    }
  }

  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    });

  return (
    <div className="flex h-dvh overflow-hidden bg-white dark:bg-surface-800">
      {/* ── mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-surface-50 dark:bg-surface-900 transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* sidebar header */}
        <div className="flex items-center gap-2 p-3">
          <button
            onClick={() => void createSession()}
            className="flex flex-1 items-center gap-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-700 px-3 py-2.5 text-sm font-medium text-surface-600 dark:text-surface-300 transition-colors hover:bg-surface-100 dark:hover:bg-surface-600"
          >
            <PlusIcon />
            新建会话
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 md:hidden"
          >
            <CloseIcon />
          </button>
        </div>

        {/* session list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {sessions.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-surface-400">
              暂无会话
            </p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`group mb-0.5 flex items-center rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                  activeSessionId === s.id
                    ? "bg-surface-200 dark:bg-surface-700"
                    : "hover:bg-surface-200/60 dark:hover:bg-surface-700/50"
                }`}
                onClick={() => void selectSession(s.id)}
              >
                <ChatIcon
                  className={`mr-2 flex-shrink-0 ${
                    activeSessionId === s.id
                      ? "text-brand-500"
                      : "text-surface-400"
                  }`}
                />
                <span className="flex-1 truncate text-sm text-surface-700 dark:text-surface-200">
                  {s.title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteSession(s.id);
                  }}
                  className="ml-1 rounded p-1 text-surface-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                  title="删除"
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>

        {/* sidebar footer */}
        <div className="border-t border-surface-200 dark:border-surface-700 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-surface-700 dark:text-surface-200">
                {user.username}
              </p>
              <p className="truncate text-xs text-surface-400">{user.email}</p>
            </div>
            <button
              onClick={() => void logout()}
              className="rounded-lg p-2 text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
              title="退出登录"
            >
              <LogoutIcon />
            </button>
          </div>
        </div>
      </aside>

      {/* ── main ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <header className="flex items-center justify-between border-b border-surface-200 dark:border-surface-700 px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700 md:hidden"
            >
              <MenuIcon />
            </button>
            <select
              className="rounded-lg border border-surface-200 dark:border-surface-700 bg-transparent px-3 py-1.5 text-sm text-surface-700 dark:text-surface-200"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {CHAT_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            {user.role === "admin" && (
              <Link
                className="rounded-lg px-3 py-1.5 text-sm text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                href="/admin/users"
              >
                管理面板
              </Link>
            )}
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              title="切换主题"
            >
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </header>

        {/* pending notice */}
        {!approved && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
            账号待审核，审核通过前不能调用模型
          </div>
        )}

        {/* messages area */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center p-4">
              <div className="text-center max-w-md">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500">
                  <HeroChatIcon />
                </div>
                <h2 className="text-2xl font-semibold text-surface-800 dark:text-white mb-2">
                  ChatUI
                </h2>
                <p className="text-surface-400 text-sm leading-relaxed">
                  选择已有会话或新建会话，开始 AI 对话
                  <br />
                  支持文本对话和图片生成
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
              {messages.map((msg) => (
                <div key={msg.id} className="group animate-fade-in">
                  <div className="flex gap-3">
                    <div
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        msg.role === "user"
                          ? "bg-brand-500 text-white"
                          : "bg-surface-200 dark:bg-surface-600 text-surface-500 dark:text-surface-300"
                      }`}
                    >
                      {msg.role === "user"
                        ? user.username.charAt(0).toUpperCase()
                        : "AI"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-medium text-surface-700 dark:text-surface-200">
                          {msg.role === "user" ? user.username : "ChatUI"}
                        </span>
                        <span className="text-xs text-surface-400">
                          {fmtTime(msg.createdAt)}
                        </span>
                        {msg.model && (
                          <span className="text-xs text-surface-400">
                            · {msg.model}
                          </span>
                        )}
                      </div>

                      {msg.type === "image" && msg.imageUrl ? (
                        <div className="space-y-2">
                          <div className="relative inline-block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              alt={msg.content}
                              className="max-h-[70dvh] max-w-full rounded-xl border border-surface-200 dark:border-surface-700 shadow-sm object-contain"
                              src={msg.imageUrl}
                            />
                            <a
                              href={msg.imageUrl}
                              download
                              className="absolute bottom-2 right-2 rounded-lg bg-black/50 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              title="下载图片"
                            >
                              <DownloadIcon />
                            </a>
                          </div>
                          <p className="text-sm text-surface-500 dark:text-surface-400">
                            {msg.content}
                          </p>
                        </div>
                      ) : (
                        <div className="text-surface-800 dark:text-surface-100">
                          <MarkdownMessage content={msg.content} />
                        </div>
                      )}

                      {msg.role === "assistant" && msg.type === "text" && (
                        <button
                          onClick={() => void copyMessage(msg.id, msg.content)}
                          className="mt-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-surface-400 opacity-0 group-hover:opacity-100 hover:text-surface-600 dark:hover:text-surface-300 transition-all"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <CheckIcon /> 已复制
                            </>
                          ) : (
                            <>
                              <CopyIcon /> 复制
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="animate-fade-in">
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-surface-200 dark:bg-surface-600 text-surface-500 dark:text-surface-300 text-xs font-semibold">
                      AI
                    </div>
                    <div className="flex items-center gap-1.5 py-2">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          )}
        </div>

        {/* error bar */}
        {error && (
          <div className="mx-auto w-full max-w-3xl px-4 pb-2">
            <div className="flex items-center justify-between rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
              <span>{error}</span>
              <button
                onClick={() => setError("")}
                className="ml-2 text-red-400 hover:text-red-600"
              >
                <CloseIcon />
              </button>
            </div>
          </div>
        )}

        {/* input area */}
        <div className="border-t border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3">
          <form
            onSubmit={(e) => void submit(e)}
            className="mx-auto max-w-3xl"
          >
            {/* mode toggle + aspect ratio */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-700 p-0.5">
                <button
                  type="button"
                  onClick={() => setMode("chat")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    mode === "chat"
                      ? "bg-white dark:bg-surface-600 text-surface-800 dark:text-white shadow-sm"
                      : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
                  }`}
                >
                  文本对话
                </button>
                <button
                  type="button"
                  onClick={() => setMode("image")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    mode === "image"
                      ? "bg-white dark:bg-surface-600 text-surface-800 dark:text-white shadow-sm"
                      : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
                  }`}
                >
                  图片生成
                </button>
              </div>

              {mode === "image" &&
                IMAGE_RATIOS.map((r) => (
                  <button
                    key={r.size}
                    type="button"
                    onClick={() => setAspectRatio(r.size)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                      aspectRatio === r.size
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
                        : "border-surface-200 dark:border-surface-700 text-surface-500 hover:border-surface-300 dark:hover:border-surface-600"
                    }`}
                    title={r.desc}
                  >
                    {r.label}
                  </button>
                ))}
            </div>

            {/* textarea + send */}
            <div className="relative flex items-end rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-700 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-colors">
              <textarea
                ref={textareaRef}
                className="max-h-40 flex-1 resize-none bg-transparent px-4 py-3 text-sm text-surface-800 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none"
                rows={1}
                disabled={!approved || loading}
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 160) + "px";
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === "chat"
                    ? "输入消息，Enter 发送，Shift+Enter 换行..."
                    : "描述你想生成的图片..."
                }
                value={input}
              />
              <button
                type="submit"
                disabled={!approved || loading || !input.trim()}
                className="m-1.5 rounded-lg bg-brand-500 p-2 text-white transition-colors hover:bg-brand-600 disabled:hover:bg-brand-500"
              >
                <SendIcon />
              </button>
            </div>

            <p className="mt-1.5 text-center text-xs text-surface-400">
              {mode === "chat"
                ? `当前模型: ${model}`
                : "当前模型: gpt-image-2"}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ─── inline icon components ─── */

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function HeroChatIcon() {
  return (
    <svg
      width="32"
      height="32"
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
  );
}
