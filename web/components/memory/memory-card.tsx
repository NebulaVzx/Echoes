'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sparkles, Star, FileText } from 'lucide-react'
import { api, Memory } from '@/lib/api'
import { getTagStyle } from './tag-filter-bar'
import { getFallbackCoverStyle } from '@/lib/tag-color'
import { useLongPress } from '@/hooks/use-long-press'

interface MemoryCardProps {
  memory: Memory
  tagColors?: Record<string, string>
  onTagClick?: (tag: string) => void
  selectable?: boolean
  selected?: boolean
  onSelectToggle?: (id: string) => void
  selectionMode?: boolean
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
  if (memory.content_type === 'weave') {
    return memory.text_content || ''
  }
  if (memory.content_type === 'text') {
    return memory.text_content || ''
  }
  if (memory.content_type === 'file') {
    return memory.file_name || memory.text_content || ''
  }
  return memory.link_title || memory.link_url || ''
}

function StatusDot({ status }: { status: string }) {
  const configs: Record<string, string> = {
    pending: 'bg-yellow-400 animate-pulse',
    processing: 'bg-blue-400 animate-pulse',
    completed: 'bg-emerald-400',
    failed: 'bg-red-400',
    partial_failed: 'bg-orange-400',
  }
  return (
    <div className={`w-1.5 h-1.5 rounded-full ${configs[status] || configs.pending}`} />
  )
}

function CoverThumbnail({ memory }: { memory: Memory }) {
  const firstTag = memory.tags?.[0] || ''

  if (memory.cover_url) {
    return (
      <div className="relative flex-shrink-0 w-[80px] h-[60px] sm:w-[100px] sm:h-[75px] md:w-[120px] md:h-[90px] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={memory.cover_url}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            // On error, hide the img and show fallback
            const target = e.currentTarget
            target.style.display = 'none'
          }}
        />
      </div>
    )
  }

  // Fallback: gradient + first letter
  const fallback = getFallbackCoverStyle(firstTag)
  const content = memory.content_type === 'weave' ? '织' :
    memory.content_type === 'link' ? '链' :
    memory.content_type === 'file' ? '档' :
    memory.text_content?.charAt(0).toUpperCase() || fallback.letter

  return (
    <div
      className="flex-shrink-0 w-[80px] h-[60px] sm:w-[100px] sm:h-[75px] md:w-[120px] md:h-[90px] rounded-lg flex items-center justify-center text-lg sm:text-xl md:text-2xl font-bold"
      style={{
        background: fallback.background,
        color: fallback.color,
      }}
    >
      {content}
    </div>
  )
}

export default function MemoryCard({
  memory,
  tagColors,
  onTagClick,
  selectable = false,
  selected = false,
  onSelectToggle,
  selectionMode = false,
}: MemoryCardProps) {
  const preview = getPreviewContent(memory)
  const isLink = memory.content_type === 'link'
  const isFile = memory.content_type === 'file'
  const isProcessing = memory.processing_status === 'pending' || memory.processing_status === 'processing'

  const [isStarred, setIsStarred] = useState(memory.is_starred)
  const [hasSuggestion, setHasSuggestion] = useState(false)
  const [suggestionPreview, setSuggestionPreview] = useState('')

  const handleStarToggle = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const next = !isStarred
    setIsStarred(next)
    try {
      await api.updateMemory(memory.id, { is_starred: next })
    } catch {
      // Revert on error
      setIsStarred(!next)
    }
  }, [isStarred, memory.id])

  // Long press for selection (mobile)
  const { handlers: longPressHandlers } = useLongPress({
    threshold: 500,
    onLongPress: () => {
      if (selectable && onSelectToggle) {
        onSelectToggle(memory.id)
      }
    },
  })

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (selectionMode && selectable && onSelectToggle) {
      // In selection mode, toggle selection instead of navigating
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        onSelectToggle(memory.id)
        return
      }
    }
  }, [selectionMode, selectable, onSelectToggle, memory.id])

  useEffect(() => {
    let cancelled = false
    const checkSuggestion = async () => {
      try {
        const response = await api.getSuggestion(memory.id)
        if (!cancelled && response.success && response.data) {
          setHasSuggestion(true)
          setSuggestionPreview(response.data.content)
        }
      } catch {
        // No suggestion or error — keep hidden
      }
    }
    checkSuggestion()
    return () => { cancelled = true }
  }, [memory.id])

  return (
    <motion.div
      whileHover={{ scale: selectionMode ? 1 : 1.01 }}
      whileTap={{ scale: selectionMode ? 1 : 0.98 }}
      transition={{ duration: 0.1 }}
      {...(selectable ? longPressHandlers : {})}
    >
      <Link href={`/memory/${memory.id}`} onClick={handleCardClick}>
        <article className={`group bg-white dark:bg-gray-800 rounded-xl border p-4 sm:p-5 transition-all duration-200 cursor-pointer flex gap-3 sm:gap-4 ${
          selected
            ? 'border-primary shadow-md dark:shadow-gray-900/30 bg-primary/5 dark:bg-primary/10'
            : 'border-gray-100 dark:border-gray-700 hover:shadow-lg dark:hover:shadow-gray-900/30 hover:border-gray-200 dark:hover:border-gray-600'
        }`}>
          {/* Selection checkbox */}
          {selectable && (
            <div className="flex-shrink-0 flex items-start pt-2">
              <div
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onSelectToggle?.(memory.id)
                }}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                  selected
                    ? 'bg-primary border-primary'
                    : 'border-gray-300 dark:border-gray-600 hover:border-primary'
                }`}
              >
                {selected && (
                  <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </div>
            </div>
          )}

          {/* Cover thumbnail */}
          <CoverThumbnail memory={memory} />

          {/* Content area */}
          <div className="flex-1 min-w-0">
            {/* Header: type + date + status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gray-50 dark:bg-gray-700">
                {isLink ? (
                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                ) : isFile ? (
                  <FileText className="w-3.5 h-3.5 text-purple-500" />
                ) : (
                  <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {isLink ? '链接' : isFile ? '文件' : '文字'}
              </span>
              <button
                onClick={handleStarToggle}
                className="p-0.5 rounded transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/30"
                title={isStarred ? '取消星标' : '标记星标'}
              >
                <Star
                  className={`w-3 h-3 transition-colors ${
                    isStarred
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-gray-300 dark:text-gray-600 hover:text-amber-400'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {isProcessing && <StatusDot status={memory.processing_status} />}
              {hasSuggestion && (
                <div className="group/suggestion relative">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 dark:text-amber-500" />
                  <div className="absolute right-0 bottom-full mb-2 w-48 p-2.5 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg z-20 opacity-0 group-hover/suggestion:opacity-100 transition-opacity pointer-events-none">
                    <p className="line-clamp-2">{suggestionPreview.substring(0, 60)}{suggestionPreview.length > 60 ? '...' : ''}</p>
                    <div className="absolute right-2 top-full w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45 -mt-1" />
                  </div>
                </div>
              )}
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {formatDate(memory.created_at)}
              </span>
            </div>
          </div>

          {/* Source attribution */}
          {memory.source && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              来源：{memory.source}
            </p>
          )}

          {/* Content preview */}
          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 leading-relaxed mb-3">
            {preview}
          </p>

          {/* Link URL (if link type) */}
          {isLink && memory.link_url && (
            <p className="text-xs text-blue-500 dark:text-blue-400 truncate mb-3 flex items-center gap-1">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              {memory.link_url}
            </p>
          )}

          {/* Tags */}
          {memory.tags && memory.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {memory.tags.map((tag) => (
                <span
                  key={tag}
                  onClick={(e) => {
                    if (onTagClick) {
                      e.preventDefault()
                      e.stopPropagation()
                      onTagClick(tag)
                    }
                  }}
                  className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full transition-colors ${
                    onTagClick ? 'cursor-pointer hover:opacity-80' : ''
                  } ${getTagStyle(tagColors?.[tag], false)}`}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Processing status line */}
          {isProcessing && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              正在分析...
            </div>
          )}
          </div>
        </article>
      </Link>
    </motion.div>
  )
}
