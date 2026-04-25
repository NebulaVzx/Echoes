'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

export const TAG_COLOR_PRESETS: Record<string, string> = {
  '#E8F4FD': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  '#E6F5E6': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  '#FFF4E6': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  '#F3E8FF': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  '#FFE4E6': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  '#E0F7FA': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  '#F5F5DC': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  '#E8F5E9': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  '#FFF8E1': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  '#FCE4EC': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  '#E3F2FD': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  '#E0F2F1': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  '#F9FBE7': 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300',
  '#EDE7F6': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  '#ECEFF1': 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
  '#FBE9E7': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

export const DEFAULT_TAG_STYLE = 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
export const SELECTED_TAG_STYLE = 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'

export function getTagStyle(color?: string, selected?: boolean): string {
  if (selected) return SELECTED_TAG_STYLE
  if (color && TAG_COLOR_PRESETS[color]) return TAG_COLOR_PRESETS[color]
  return DEFAULT_TAG_STYLE
}

interface TagFilterBarProps {
  tags: { name: string; count: number; color?: string }[]
  selectedTags: string[]
  onTagToggle: (tag: string) => void
  onClearAll: () => void
  maxVisible?: number
}

export default function TagFilterBar({
  tags,
  selectedTags,
  onTagToggle,
  onClearAll,
  maxVisible = 10,
}: TagFilterBarProps) {
  const visibleTags = tags.slice(0, maxVisible)
  const hasMore = tags.length > maxVisible

  const handleTagClick = useCallback((tagName: string) => {
    onTagToggle(tagName)
  }, [onTagToggle])

  if (tags.length === 0 && selectedTags.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
      <div className="flex items-center gap-1.5 flex-nowrap">
        {visibleTags.map((tag) => {
          const isSelected = selectedTags.includes(tag.name)
          return (
            <button
              key={tag.name}
              onClick={() => handleTagClick(tag.name)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full transition-all duration-150 whitespace-nowrap ${getTagStyle(tag.color, isSelected)} hover:opacity-80`}
            >
              {tag.name}
              <span className={`text-[10px] opacity-60 ${isSelected ? 'text-white/70 dark:text-gray-900/70' : ''}`}>
                {tag.count}
              </span>
            </button>
          )
        })}

        {hasMore && (
          <Link
            href="/tags"
            className="inline-flex items-center px-2.5 py-1 text-xs rounded-full bg-gray-50 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
          >
            更多 →
          </Link>
        )}
      </div>

      {selectedTags.length > 0 && (
        <button
          onClick={onClearAll}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors whitespace-nowrap flex-shrink-0 ml-1"
        >
          <X className="w-3 h-3" />
          清除全部
        </button>
      )}
    </div>
  )
}
