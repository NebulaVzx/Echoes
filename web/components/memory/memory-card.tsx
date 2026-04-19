'use client'

import Link from 'next/link'
import { Memory } from '@/lib/api'

interface MemoryCardProps {
  memory: Memory
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getPreviewContent(memory: Memory): string {
  if (memory.content_type === 'text') {
    return memory.text_content || ''
  }
  return memory.link_title || memory.link_url || ''
}

export default function MemoryCard({ memory }: MemoryCardProps) {
  const preview = getPreviewContent(memory)
  const isLink = memory.content_type === 'link'

  return (
    <Link href={`/memory/${memory.id}`}>
      <div className="group bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md dark:hover:shadow-gray-900/20 transition-all duration-200 cursor-pointer">
        {/* Header: type indicator + date */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isLink ? (
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {isLink ? '链接' : '文字'}
            </span>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatDate(memory.created_at)}
          </span>
        </div>

        {/* Content preview */}
        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 leading-relaxed mb-3">
          {preview}
        </p>

        {/* Link URL (if link type) */}
        {isLink && memory.link_url && (
          <p className="text-xs text-blue-500 dark:text-blue-400 truncate mb-3">
            {memory.link_url}
          </p>
        )}

        {/* Tags */}
        {memory.tags && memory.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {memory.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Processing status */}
        {memory.processing_status === 'pending' && (
          <div className="mt-3 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-xs text-yellow-600 dark:text-yellow-400">处理中...</span>
          </div>
        )}
      </div>
    </Link>
  )
}
