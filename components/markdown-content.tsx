"use client"

import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type Props = {
  markdown: string
}

export function MarkdownContent({ markdown }: Props) {
  return (
    <div
      className="markdown-content max-w-none prose prose-invert prose-p:leading-relaxed prose-headings:scroll-mt-24 prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-sky-400 prose-a:underline-offset-2 hover:prose-a:text-sky-300 prose-code:rounded-md prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sky-200 prose-pre:bg-slate-950/80 prose-pre:ring-1 prose-pre:ring-white/10 prose-li:marker:text-slate-500 prose-table:border prose-table:border-white/15 prose-th:border prose-th:border-white/15 prose-th:bg-white/5 prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-white/10 prose-td:px-3 prose-td:py-2"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...rest }) => {
            if (href?.startsWith("/")) {
              return (
                <Link href={href} className="font-medium text-sky-400 underline underline-offset-2 hover:text-sky-300" {...rest}>
                  {children}
                </Link>
              )
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sky-400 underline underline-offset-2 hover:text-sky-300"
                {...rest}
              >
                {children}
              </a>
            )
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
