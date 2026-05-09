'use client'

import { Badge } from '@/components/ui/badge'
import { ConnectionReason } from './ConnectionReason'
import type { ExploreResponse } from '@/types/constellation'

// ExploreResponse['results'][0] is flat: { ...safeMemory, similarity, reason }
interface RelatedMemoryCardProps {
  memory: ExploreResponse['results'][0]
  onClick?: () => void
}

export function RelatedMemoryCard({ memory, onClick }: RelatedMemoryCardProps) {
  const preview = memory.text_content
    ? memory.text_content.slice(0, 80) + (memory.text_content.length > 80 ? '...' : '')
    : memory.link_title
    ? memory.link_title
    : memory.file_name
    ? memory.file_name
    : '未命名记忆'

  return (
    <button
      onClick={onClick}
      className="w-full text-left border rounded-lg p-3 hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium line-clamp-2 flex-1">{preview}</p>
        <Badge variant="secondary" className="shrink-0 text-xs">
          相似度 {(memory.similarity * 100).toFixed(0)}%
        </Badge>
      </div>
      <ConnectionReason reason={memory.reason} />
      {memory.tags && memory.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {memory.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 bg-secondary rounded-full text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
