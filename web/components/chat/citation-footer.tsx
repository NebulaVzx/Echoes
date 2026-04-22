'use client'

import { Citation } from '@/types/chat'
import { ExternalLink } from 'lucide-react'

interface CitationFooterProps {
  citations: Citation[]
}

export default function CitationFooter({ citations }: CitationFooterProps) {
  if (!citations || citations.length === 0) return null

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">引用来源</p>
      <div className="flex flex-wrap gap-2">
        {citations.map((citation) => (
          <a
            key={citation.index}
            href={`/memory/${citation.memory_id}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="font-medium text-blue-600 dark:text-blue-400">[{citation.index}]</span>
            <span className="max-w-[200px] truncate">{citation.title}</span>
            <ExternalLink className="w-3 h-3 text-gray-400" />
          </a>
        ))}
      </div>
    </div>
  )
}
