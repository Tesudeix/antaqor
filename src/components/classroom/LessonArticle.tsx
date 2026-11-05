"use client";

// Medium-style article renderer for a lesson's markdown `content`.
// AI community focus — every <pre> code block (where prompts live) gets a
// "Copy" button on hover so members can grab a prompt in one tap.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";

const ACCENT = "var(--accent-ink, #2E29FF)";

// ─── Copyable code/prompt block ────────────────────────────────────────
// Reads the inner text once, copies it to the clipboard, briefly shows a
// "Хуулсан ✓" confirmation. Lives inside <pre> so it covers the whole
// block — including multi-language fenced code that react-markdown wraps
// in <code class="language-…">.
function CopyablePre({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    // The <code> child holds the raw text; pull it out via a ref-less DOM
    // approach by finding the rendered text node. Simpler + cross-browser:
    // recursively flatten react children.
    const flatten = (node: ReactNode): string => {
      if (node == null || typeof node === "boolean") return "";
      if (typeof node === "string" || typeof node === "number") return String(node);
      if (Array.isArray(node)) return node.map(flatten).join("");
      if (typeof node === "object" && "props" in node) {
        const props = (node as { props?: { children?: ReactNode } }).props;
        return flatten(props?.children);
      }
      return "";
    };
    const text = flatten(children).replace(/\n$/, "");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — silent */
    }
  };

  return (
    <pre className="group relative my-7 overflow-x-auto rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#ffffff] p-4 pr-12 font-mono text-[14px] leading-[1.55] text-[#D4D4D8]">
      {children}
      <button
        type="button"
        onClick={onCopy}
        title="Хуулах"
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#141416]/95 px-2 py-1 text-[10px] font-bold backdrop-blur-sm transition opacity-0 group-hover:opacity-100 focus:opacity-100"
        style={{ color: copied ? "#4FE065" : ACCENT }}
      >
        {copied ? (
          <>
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Хуулсан
          </>
        ) : (
          <>
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
            </svg>
            Хуулах
          </>
        )}
      </button>
    </pre>
  );
}

export function LessonArticle({ content }: { content: string }) {
  if (!content?.trim()) return null;
  return (
    <article className="mx-auto my-10 w-full max-w-[680px] px-1 text-[#0e1726]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-6 mt-12 text-[22px] md:text-[34px] font-black leading-[1.15] tracking-tight sm:text-[26px] md:text-[40px]" style={{ color: "#FFFFFF" }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-4 mt-10 text-[24px] font-black leading-[1.25] tracking-tight sm:text-[28px]" style={{ color: "#FFFFFF" }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-3 mt-8 text-[19px] font-bold leading-[1.3] sm:text-[21px]" style={{ color: "var(--t-ink, #14151C)" }}>
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-2 mt-6 text-[15px] font-bold uppercase tracking-[0.12em]" style={{ color: "#565967" }}>
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-7 text-[18px] leading-[1.75] text-[#D4D4D8] sm:text-[19px]">
              {children}
            </p>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
              className="border-b transition hover:opacity-90"
              style={{ color: ACCENT, borderColor: "rgba(46,41,255,0.33)" }}
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-bold" style={{ color: "#FFFFFF" }}>{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic" style={{ color: "var(--t-ink, #14151C)" }}>{children}</em>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className="my-8 border-l-2 pl-5 text-[20px] italic leading-[1.65] sm:text-[22px]"
              style={{ borderColor: ACCENT, color: "var(--t-ink, #14151C)" }}
            >
              {children}
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="my-6 ml-5 list-disc space-y-2.5 text-[18px] leading-[1.7] text-[#D4D4D8] marker:text-[#E2E4E8] sm:text-[19px]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-6 ml-5 list-decimal space-y-2.5 text-[18px] leading-[1.7] text-[#D4D4D8] marker:text-[#E2E4E8] sm:text-[19px]">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          hr: () => (
            <hr className="mx-auto my-12 w-16 border-0 border-t" style={{ borderColor: "rgba(46,41,255,0.40)" }} />
          ),
          code: ({ inline, className, children, ...props }: ComponentProps<"code"> & { inline?: boolean }) => {
            if (inline) {
              return (
                <code
                  className="rounded-[4px] px-1.5 py-0.5 font-mono text-[15px]"
                  style={{ background: "rgba(46,41,255,0.12)", color: ACCENT }}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={`block ${className || ""}`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <CopyablePre>{children}</CopyablePre>,
          img: ({ src, alt }) => (
            // Full-bleed inside the 680px column; caption only if alt text exists.
            <figure className="my-9">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={typeof src === "string" ? src : ""}
                alt={alt || ""}
                className="w-full rounded-[4px] border border-[rgba(15,23,38,0.05)] bg-[#ffffff]"
              />
              {alt && (
                <figcaption className="mt-2 text-center text-[13px] text-[#E2E4E8]">
                  {alt}
                </figcaption>
              )}
            </figure>
          ),
          table: ({ children }) => (
            <div className="my-7 overflow-x-auto rounded-[4px] border border-[rgba(15,23,38,0.06)]">
              <table className="w-full border-collapse text-[15px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th
              className="border-b px-3 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ borderColor: "rgba(15,23,38,0.08)", color: ACCENT }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-[rgba(15,23,38,0.04)] px-3 py-2 text-[#D4D4D8]">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
