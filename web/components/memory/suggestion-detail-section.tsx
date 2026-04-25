'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { api, AISuggestion } from '@/lib/api'
import { Sparkles, ThumbsUp, ThumbsDown } from 'lucide-react'

interface SuggestionDetailSectionProps {
  memoryId: string
}

export default function SuggestionDetailSection({ memoryId }: SuggestionDetailSectionProps) {
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [feedback, setFeedback] = useState<string | undefined>()

  // Poll for suggestion — handles the case where suggestion is generated after page load
  useEffect(() => {
    let cancelled = false
    let timeoutId: NodeJS.Timeout | null = null
    let attempts = 0
    const maxAttempts = 20 // ~60s with backoff

    const loadSuggestion = async () => {
      try {
        const response = await api.getSuggestion(memoryId)
        if (!cancelled && response.success && response.data) {
          setSuggestion(response.data)
          setFeedback(response.data.user_feedback)
          setIsLoading(false)
          return // stop polling
        }
      } catch {
        // No suggestion or error — keep polling
      }

      attempts++
      if (attempts >= maxAttempts) {
        if (!cancelled) setIsLoading(false)
        return // stop polling
      }

      // Exponential backoff
      const delay = Math.min(2000 + Math.floor(attempts / 3) * 1000, 5000)
      timeoutId = setTimeout(loadSuggestion, delay)
    }

    loadSuggestion()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [memoryId])

  const handleFeedback = async (type: 'liked' | 'disliked') => {
    if (feedback || !suggestion) return
    setFeedback(type)
    try {
      await api.updateSuggestionFeedback(memoryId, type)
    } catch {
      // Silently fail
    }
  }

  if (isLoading) {
    return (
      <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-full animate-pulse" />
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
        </div>
      </div>
    )
  }

  if (!suggestion) {
    return (
      <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400 animate-pulse" />
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            AI 建议
          </h3>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30 p-5">
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            AI 正在生成建议，请稍候...
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          AI 建议
        </h3>
        {suggestion.suggestion_type && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {suggestionTypeLabel(suggestion.suggestion_type)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30 p-5">
        <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed mb-4">
          {suggestion.content}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleFeedback('liked')}
              disabled={!!feedback}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                feedback === 'liked'
                  ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/50'
              } disabled:opacity-50`}
            >
              <ThumbsUp className="w-3 h-3" />
              有用
            </button>
            <button
              onClick={() => handleFeedback('disliked')}
              disabled={!!feedback}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                feedback === 'disliked'
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/50'
              } disabled:opacity-50`}
            >
              <ThumbsDown className="w-3 h-3" />
              不用了
            </button>
            {feedback === 'liked' && (
              <span className="text-xs text-amber-500 dark:text-amber-400">
                已收藏这条建议
              </span>
            )}
            {feedback === 'disliked' && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                已反馈，会减少同类建议
              </span>
            )}
          </div>

          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatSuggestionDate(suggestion.created_at)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

function suggestionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    emotion_support: '情绪支持',
    knowledge_expand: '知识拓展',
    action_suggest: '行动建议',
    connection: '关联发现',
    general: '一般建议',
  }
  return labels[type] || type
}

function formatSuggestionDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
