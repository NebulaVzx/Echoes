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

  useEffect(() => {
    let cancelled = false
    const loadSuggestion = async () => {
      try {
        const response = await api.getSuggestion(memoryId)
        if (!cancelled && response.success && response.data) {
          setSuggestion(response.data)
          setFeedback(response.data.user_feedback)
        }
      } catch {
        // No suggestion or error
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadSuggestion()
    return () => { cancelled = true }
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

  if (!suggestion) return null

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
