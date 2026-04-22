'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import { Citation } from '@/types/chat'

interface MarkdownRendererProps {
  content: string
  citations?: Citation[]
}

export function MarkdownRenderer({ content, citations }: MarkdownRendererProps) {
  if (citations && citations.length > 0) {
    return (
      <MarkdownWithCitations content={content} citations={citations} />
    )
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function MarkdownWithCitations({ content, citations }: { content: string; citations: Citation[] }) {
  const parts = content.split(/(\[\d+\])/g)

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        const match = part.match(/\[(\d+)\]/)
        if (match) {
          const idx = parseInt(match[1])
          const citation = citations.find(c => c.index === idx)
          if (citation) {
            return (
              <a
                key={i}
                href={`/memory/${citation.memory_id}`}
                className="inline-flex items-center px-1 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 mx-0.5"
                title={`${citation.title} (相似度: ${(citation.similarity * 100).toFixed(1)}%)`}
              >
                [{idx}]
              </a>
            )
          }
          return <span key={i}>{part}</span>
        }
        if (!part.trim()) return null
        return (
          <div key={i} className="prose prose-sm dark:prose-invert max-w-none inline">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                a: ({ node, ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline" />
                ),
                p: ({ children }) => <span>{children}</span>,
              }}
            >
              {part}
            </ReactMarkdown>
          </div>
        )
      })}
    </div>
  )
}
