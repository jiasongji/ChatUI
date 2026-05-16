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

type AttachmentMeta = {
  name: string;
  path: string;
  type: string;
  size: number;
};

type Message = {
  id: string;
  role: string;
  content: string;
  model: string | null;
  type: string;
  imageUrl: string | null;
  attachments: string | null;
  createdAt: string;
};

const IMAGE_RATIOS = [
  { label: "自动", value: "", desc: "由模型自动选择" },
  { label: "方形 1:1", value: "1024x1024", desc: "正方形" },
  { label: "竖版 3:4", value: "1024x1536", desc: "纵向" },
  { label: "横版 4:3", value: "1536x1024", desc: "横向" },
  { label: "宽屏 16:9", value: "1792x1024", desc: "宽屏" },
  { label: "故事版 9:16", value: "1024x1792", desc: "竖屏" },
];

const CONTEXT_LIMIT = 30;

const CHAT_ACCEPT =
  ".jpg,.jpeg,.png,.gif,.webp,.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.html,.css,.xml,.yaml,.yml,.sh,.sql,.go,.rs,.java,.c,.cpp,.h,.rb,.php,.swift,.kt,.toml";
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export function ChatClient({ user }: { user: User }) {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<"chat" | "image">("chat");
  const [chatModels, setChatModels] = useState<string[]>(["gpt-5.4-mini"]);
  const [imageModels, setImageModels] = useState<string[]>(["gpt-image-2"]);
  const [model, setModel] = useState("gpt-5.4-mini");
  const [imageModel, setImageModel] = useState("gpt-image-2");
  const [aspectRatio, setAspectRatio] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"chat" | "image" | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [scrollNavVisible, setScrollNavVisible] = useState(false);
  const [scrollNavFading, setScrollNavFading] = useState(false);
  const [scrollNearTop, setScrollNearTop] = useState(false);
  const [scrollNearBottom, setScrollNearBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const messagesAreaRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFailedRef = useRef<{ prompt: string; mode: "chat" | "image"; model: string; aspectRatio: string; sessionId: string } | null>(null);
  const approved = user.status === "approved";

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    void refreshSessions();
    void fetchModels();
  }, []);

  async function fetchModels() {
    try {
      const res = await fetch("/api/models", { cache: "no-store" });
      const json = await res.json();
      if (json?.ok) {
        setChatModels(json.data.chatModels);
        setImageModels(json.data.imageModels);
        if (json.data.chatModels.length > 0) setModel(json.data.chatModels[0]);
        if (json.data.imageModels.length > 0)
          setImageModel(json.data.imageModels[0]);
      }
    } catch {
      /* fallback to defaults */
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    if (!scrollNearBottom && messages.length > 0) showScrollNav();
  }, [messages, loading]);

  function showScrollNav() {
    setScrollNavVisible(true);
    setScrollNavFading(false);
    if (scrollHideTimer.current) clearTimeout(scrollHideTimer.current);
    scrollHideTimer.current = setTimeout(() => {
      setScrollNavFading(true);
      setTimeout(() => setScrollNavVisible(false), 400);
    }, 2500);
  }

  useEffect(() => {
    const area = messagesAreaRef.current;
    if (!area) return;
    const onScroll = () => {
      const gapBottom = area.scrollHeight - area.scrollTop - area.clientHeight;
      setScrollNearBottom(gapBottom < 80);
      setScrollNearTop(area.scrollTop < 80);
      const needNav = gapBottom > 120 || area.scrollTop > 200;
      if (needNav) showScrollNav();
      else {
        setScrollNavVisible(false);
        setScrollNavFading(false);
        if (scrollHideTimer.current) clearTimeout(scrollHideTimer.current);
      }
    };
    area.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      area.removeEventListener("scroll", onScroll);
      if (scrollHideTimer.current) clearTimeout(scrollHideTimer.current);
    };
  }, []);

  useEffect(() => {
    if (loading) {
      setElapsed(0);
      elapsedRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [loading]);

  function requestNotificationPermission() {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }

  function sendBrowserNotification(title: string, body: string) {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") return;
    try {
      const n = new Notification(title, { body });
      n.onclick = () => { window.focus(); n.close(); };
    } catch {
      // Notification constructor may throw in some contexts
    }
  }

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
        body: JSON.stringify({ title: "新会话" }),
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
        method: "DELETE",
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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files || []);
    if (mode === "image") {
      setSelectedFiles(newFiles.slice(0, 1));
    } else {
      setSelectedFiles((prev) => {
        const combined = [...prev, ...newFiles];
        return combined.slice(0, 5);
      });
    }
    e.target.value = "";
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || loading) return;
    if (!approved) {
      setError("账号已提交审核，请等待管理员批准");
      return;
    }

    const promptText = input.trim();
    const currentMode = mode;

    setLoading(true);
    setLoadingMode(currentMode);
    setLoadingPrompt(promptText);
    setError("");

    requestNotificationPermission();

    try {
      const sessionId = activeSessionId || (await createSession());
      const currentModel = currentMode === "chat" ? model : imageModel;
      const endpoint = currentMode === "chat" ? "/api/chat" : "/api/images";

      lastFailedRef.current = { prompt: promptText, mode: currentMode, model: currentModel, aspectRatio, sessionId };

      const fd = new FormData();
      if (currentMode === "chat") {
        fd.append("sessionId", sessionId);
        fd.append("model", currentModel);
        fd.append("content", promptText);
        selectedFiles.forEach((file) => fd.append("files", file));
      } else {
        fd.append("sessionId", sessionId);
        fd.append("model", currentModel);
        fd.append("prompt", promptText);
        if (aspectRatio) fd.append("size", aspectRatio);
        if (selectedFiles[0]) fd.append("image", selectedFiles[0]);
      }

      const data = await parseResponse(
        await fetch(endpoint, { method: "POST", body: fd })
      );

      setInput("");
      setSelectedFiles([]);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      lastFailedRef.current = null;

      if (currentMode === "chat") {
        setMessages((cur) => [...cur, data.userMessage, data.assistantMessage]);
      } else {
        setMessages((cur) => [...cur, data.userMessage, data.imageMessage]);
      }
      await refreshSessions();

      sendBrowserNotification(
        currentMode === "image" ? "图片生成完成" : "ChatUI 回复完成",
        currentMode === "image"
          ? promptText.length > 30 ? promptText.slice(0, 30) + "…" : promptText
          : ""
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "发送失败，请稍后重试";
      setError(errMsg);
      sendBrowserNotification(
        currentMode === "image" ? "图片生成失败" : "消息发送失败",
        errMsg.length > 50 ? errMsg.slice(0, 50) + "…" : errMsg
      );
    } finally {
      setLoading(false);
      setLoadingMode(null);
      setLoadingPrompt("");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  async function retry() {
    const failed = lastFailedRef.current;
    if (!failed || loading) return;
    setError("");
    setLoading(true);
    setLoadingMode(failed.mode);
    setLoadingPrompt(failed.prompt);
    requestNotificationPermission();

    try {
      const endpoint = failed.mode === "chat" ? "/api/chat" : "/api/images";
      const fd = new FormData();
      if (failed.mode === "chat") {
        fd.append("sessionId", failed.sessionId);
        fd.append("model", failed.model);
        fd.append("content", failed.prompt);
      } else {
        fd.append("sessionId", failed.sessionId);
        fd.append("model", failed.model);
        fd.append("prompt", failed.prompt);
        if (failed.aspectRatio) fd.append("size", failed.aspectRatio);
      }

      const data = await parseResponse(
        await fetch(endpoint, { method: "POST", body: fd })
      );

      lastFailedRef.current = null;
      if (failed.mode === "chat") {
        setMessages((cur) => [...cur, data.userMessage, data.assistantMessage]);
      } else {
        setMessages((cur) => [...cur, data.userMessage, data.imageMessage]);
      }
      await refreshSessions();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "重试失败，请稍后再试";
      setError(errMsg);
    } finally {
      setLoading(false);
      setLoadingMode(null);
      setLoadingPrompt("");
    }
  }

  function scrollToBottom() {
    setScrollNavVisible(false);
    if (scrollHideTimer.current) clearTimeout(scrollHideTimer.current);
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function scrollToTop() {
    setScrollNavVisible(false);
    if (scrollHideTimer.current) clearTimeout(scrollHideTimer.current);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.closest("form")?.requestSubmit();
    }
  }

  function parseAttachments(raw: string | null): AttachmentMeta[] {
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  const currentModel = mode === "chat" ? model : imageModel;
  const modelList = mode === "chat" ? chatModels : imageModels;

  const textMsgCount = messages.filter(
    (m) => m.type === "text" && (m.role === "user" || m.role === "assistant")
  ).length;
  const contextPercent = Math.min(
    Math.round((textMsgCount / CONTEXT_LIMIT) * 100),
    100
  );
  const contextWarning = textMsgCount >= CONTEXT_LIMIT * 0.8;

  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const collapsed = sidebarCollapsed;

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
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-surface-50 dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700 transition-all duration-200 md:static ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${collapsed ? "w-[56px]" : "w-[260px]"}`}
      >
        {/* sidebar header */}
        <div className={`flex items-center gap-1.5 p-2 ${collapsed ? "flex-col" : ""}`}>
          {collapsed ? (
            <>
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="flex items-center justify-center rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-700 p-2 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-600 transition-colors w-10 h-10"
                title="展开侧边栏"
              >
                <ExpandIcon />
              </button>
              <button
                onClick={() => void createSession()}
                className="flex items-center justify-center rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-700 p-2 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-600 transition-colors w-10 h-10"
                title="新建会话"
              >
                <PlusIcon />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => void createSession()}
                className="flex flex-1 items-center gap-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-700 px-3 py-2.5 text-sm font-medium text-surface-600 dark:text-surface-300 transition-colors hover:bg-surface-100 dark:hover:bg-surface-600"
              >
                <PlusIcon />
                新建会话
              </button>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="hidden rounded-lg p-2 text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 md:block flex-shrink-0"
                title="折叠侧边栏"
              >
                <CollapseLeftIcon />
              </button>
            </>
          )}
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 md:hidden flex-shrink-0"
          >
            <CloseIcon />
          </button>
        </div>

        {/* session list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {sessions.length === 0 ? (
            !collapsed && (
              <p className="px-2 py-8 text-center text-sm text-surface-400">
                暂无会话
              </p>
            )
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`group mb-0.5 flex items-center rounded-lg cursor-pointer transition-colors ${
                  collapsed ? "justify-center p-2" : "px-2.5 py-2"
                } ${
                  activeSessionId === s.id
                    ? "bg-surface-200 dark:bg-surface-700"
                    : "hover:bg-surface-200/60 dark:hover:bg-surface-700/50"
                }`}
                onClick={() => void selectSession(s.id)}
                title={collapsed ? s.title : undefined}
              >
                <ChatIcon
                  className={`flex-shrink-0 ${collapsed ? "" : "mr-2"} ${
                    activeSessionId === s.id
                      ? "text-brand-500"
                      : "text-surface-400"
                  }`}
                />
                {!collapsed && (
                  <>
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
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* sidebar footer */}
        <div className="border-t border-surface-200 dark:border-surface-700 p-2">
          <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white"
              title={collapsed ? user.username : undefined}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <>
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
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ── main ── */}
      <div className="flex min-w-0 flex-1 flex-col relative">
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
              value={currentModel}
              onChange={(e) => {
                if (mode === "chat") setModel(e.target.value);
                else setImageModel(e.target.value);
              }}
            >
              {modelList.map((m) => (
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

        {/* context warning */}
        {contextWarning && approved && !loading && messages.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between gap-3 text-sm text-amber-700 dark:text-amber-400">
            <span>
              {textMsgCount >= CONTEXT_LIMIT
                ? `上下文已达上限 (${CONTEXT_LIMIT} 条)，最早的消息将被自动丢弃`
                : `上下文即将满 (${textMsgCount}/${CONTEXT_LIMIT})，较早的消息可能被截断`}
            </span>
            <button
              onClick={() => void createSession()}
              className="rounded-md border border-amber-300 dark:border-amber-700 px-2.5 py-1 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors whitespace-nowrap"
            >
              新会话
            </button>
          </div>
        )}

        {/* messages area */}
        <div ref={messagesAreaRef} className="min-h-0 flex-1 overflow-y-auto">
          {messages.length === 0 && !loading ? (
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
                  支持聊天、图片生成与编辑、文件上传
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5 px-4 py-6"><div ref={topRef} />
              {messages.map((msg) => {
                const attachments = parseAttachments(msg.attachments);
                return (
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
                                className="absolute bottom-2 right-2 rounded-lg bg-black/50 p-1.5 text-white md:opacity-0 md:group-hover:opacity-100 transition-opacity"
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

                        {/* attachments */}
                        {attachments.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {attachments.map((att, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-1.5 rounded-md border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-700 px-2 py-1 text-xs"
                              >
                                {att.type.startsWith("image/") ? (
                                  <img
                                    src={`/api/uploads/${att.path}`}
                                    className="h-6 w-6 rounded object-cover"
                                    alt={att.name}
                                  />
                                ) : (
                                  <FileIcon />
                                )}
                                <a
                                  href={`/api/uploads/${att.path}`}
                                  download={att.name}
                                  className="text-brand-500 hover:text-brand-600 max-w-[120px] truncate transition-colors"
                                >
                                  {att.name}
                                </a>
                              </div>
                            ))}
                          </div>
                        )}

                        {msg.role === "assistant" && msg.type === "text" && (
                          <button
                            onClick={() => void copyMessage(msg.id, msg.content)}
                            className="mt-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-surface-400 md:opacity-0 md:group-hover:opacity-100 hover:text-surface-600 dark:hover:text-surface-300 transition-all"
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
                );
              })}

              {loading && loadingMode === "image" && (
                <div className="animate-fade-in-up">
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-surface-200 dark:bg-surface-600 text-surface-500 dark:text-surface-300 text-xs font-semibold">
                      AI
                    </div>
                    <div className="min-w-0 flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-700/50 p-3.5 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <PaintbrushIcon />
                        <span className="text-sm font-medium text-surface-700 dark:text-surface-200">
                          正在生成图片…
                        </span>
                      </div>
                      {loadingPrompt && (
                        <p className="text-xs text-surface-500 dark:text-surface-400 line-clamp-2">
                          "{loadingPrompt.length > 80 ? loadingPrompt.slice(0, 80) + "…" : loadingPrompt}"
                        </p>
                      )}
                      <div className="loading-progress-bar w-full" />
                      <div className="flex items-center justify-between text-xs text-surface-400">
                        <span>
                          已等待 {elapsed} 秒{elapsed < 30 ? "，通常需要 30-90 秒" : ""}
                        </span>
                        <span className="hidden sm:inline">完成后会收到通知，可切换到其他页面</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {loading && loadingMode === "chat" && (
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
                    {elapsed >= 3 && (
                      <span className="text-xs text-surface-400 animate-fade-in">
                        已等待 {elapsed} 秒
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          )}

        </div>

        {/* scroll navigation */}
        {scrollNavVisible && (
          <div className={`absolute right-3 bottom-24 z-10 flex flex-col gap-1.5 transition-opacity duration-300 ${scrollNavFading ? 'opacity-0' : 'opacity-100'}`}>
            {!scrollNearTop && (
              <button
                onClick={scrollToTop}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-200/80 dark:bg-surface-600/80 text-surface-600 dark:text-surface-300 shadow-sm backdrop-blur-sm hover:bg-surface-300 dark:hover:bg-surface-500 active:scale-90 transition-all"
                title="回到顶部"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            )}
            {!scrollNearBottom && (
              <button
                onClick={scrollToBottom}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-200/80 dark:bg-surface-600/80 text-surface-600 dark:text-surface-300 shadow-sm backdrop-blur-sm hover:bg-surface-300 dark:hover:bg-surface-500 active:scale-90 transition-all"
                title="回到最新"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* error bar */}
        {error && (
          <div className="mx-auto w-full max-w-3xl px-4 pb-2">
            <div className="flex items-center justify-between rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
              <span className="flex-1 min-w-0">{error}</span>
              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                {lastFailedRef.current && (
                  <button
                    onClick={() => void retry()}
                    disabled={loading}
                    className="rounded-md bg-red-100 dark:bg-red-800/50 px-2.5 py-1 text-xs font-medium hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-50"
                  >
                    重试
                  </button>
                )}
                <button
                  onClick={() => setError("")}
                  className="text-red-400 hover:text-red-600"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* input area */}
        <div className="border-t border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3">
          <form onSubmit={(e) => void submit(e)} className="mx-auto max-w-3xl">
            {/* mode toggle + aspect ratio */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-700 p-0.5">
                <button
                  type="button"
                  onClick={() => { setMode("chat"); setSelectedFiles([]); }}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    mode === "chat"
                      ? "bg-white dark:bg-surface-600 text-surface-800 dark:text-white shadow-sm"
                      : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
                  }`}
                >
                  聊天模式
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("image"); setSelectedFiles([]); }}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    mode === "image"
                      ? "bg-white dark:bg-surface-600 text-surface-800 dark:text-white shadow-sm"
                      : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
                  }`}
                >
                  图片生成
                </button>
              </div>

              {mode === "image" && (
                <select
                  className="rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-700 px-2.5 py-1 text-xs text-surface-600 dark:text-surface-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                >
                  {IMAGE_RATIOS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* file preview */}
            {selectedFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selectedFiles.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-700 px-2.5 py-1.5 text-xs"
                  >
                    {file.type.startsWith("image/") ? (
                      <img
                        src={URL.createObjectURL(file)}
                        className="h-8 w-8 rounded object-cover"
                        alt={file.name}
                      />
                    ) : (
                      <FileIcon />
                    )}
                    <span className="max-w-[100px] truncate text-surface-600 dark:text-surface-300">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-surface-400 hover:text-red-500 transition-colors"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* textarea + buttons */}
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
                    ? "输入消息..."
                    : "描述你想生成的图片..."
                }
                value={input}
              />
              <div className="flex items-end gap-0.5 p-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!approved || loading}
                  className="rounded-lg p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors disabled:opacity-40"
                  title={mode === "image" ? "上传图片进行编辑" : "上传附件"}
                >
                  {mode === "image" ? <ImageUploadIcon /> : <PaperclipIcon />}
                </button>
                <button
                  type="submit"
                  disabled={!approved || loading || !input.trim()}
                  className="rounded-lg bg-brand-500 p-2 text-white transition-colors hover:bg-brand-600 disabled:hover:bg-brand-500"
                >
                  <SendIcon />
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={mode === "image" ? IMAGE_ACCEPT : CHAT_ACCEPT}
              multiple={mode === "chat"}
              onChange={handleFileSelect}
            />

            <div className="mt-1.5 flex items-center justify-between text-xs text-surface-400">
              <span>当前模型: {currentModel}</span>
              {mode === "chat" && messages.length > 0 && (
                <span className={contextWarning ? "text-amber-500 font-medium" : ""}>
                  上下文 {textMsgCount}/{CONTEXT_LIMIT}
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ─── inline icon components ─── */

function PlusIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CollapseLeftIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 5v14" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 5v14" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
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
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function HeroChatIcon() {
  return (
    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

function ImageUploadIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function PaintbrushIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-brand-500">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </svg>
  );
}
