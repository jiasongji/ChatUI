"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const EXT_MAP: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  ruby: "rb",
  rust: "rs",
  golang: "go",
  bash: "sh",
  shell: "sh",
  markdown: "md",
  kotlin: "kt",
  scala: "scala",
};

function downloadCode(code: string, lang: string) {
  const ext = EXT_MAP[lang] || lang || "txt";
  const blob = new Blob([code], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `code.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="prose prose-slate max-w-none dark:prose-invert prose-pre:p-0 prose-pre:bg-transparent prose-code:before:content-[''] prose-code:after:content-['']">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            return <>{children}</>;
          },
          code({ className, children, ...rest }) {
            const match = /language-(\w+)/.exec(className || "");
            const code = String(children).replace(/\n$/, "");

            if (className) {
              return (
                <div className="not-prose my-4 rounded-lg border border-surface-200 dark:border-surface-600 overflow-hidden">
                  <div className="flex items-center justify-between bg-surface-200 dark:bg-surface-700 px-4 py-1.5 text-xs text-surface-500">
                    <span>{match?.[1] || "code"}</span>
                    <div className="flex gap-3">
                      <button
                        onClick={() => navigator.clipboard.writeText(code)}
                        className="hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
                      >
                        复制
                      </button>
                      <button
                        onClick={() =>
                          downloadCode(code, match?.[1] || "txt")
                        }
                        className="hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
                      >
                        下载
                      </button>
                    </div>
                  </div>
                  <pre className="m-0 bg-surface-100 dark:bg-surface-600 p-3 overflow-x-auto text-sm text-surface-800 dark:text-surface-200">
                    <code>{children}</code>
                  </pre>
                </div>
              );
            }

            return (
              <code
                className="px-1 py-0.5 rounded bg-surface-100 dark:bg-surface-600 text-sm font-mono"
                {...rest}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
