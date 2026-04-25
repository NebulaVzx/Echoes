'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api, AISuggestion } from '@/lib/api'
import { Sparkles, ThumbsUp, ThumbsDown, X } from 'lucide-react'

interface AISuggestionCardProps {
  memoryId: string
  initialSuggestion?: AISuggestion
  suggestionStatus: 'pending' | 'completed' | 'skipped' | 'failed'
  onDismiss?: () => void
}

export default function AISuggestionCard({
  memoryId,
  initialSuggestion,
  suggestionStatus,
  onDismiss,
}: AISuggestionCardProps) {
  const [suggestion, setSuggestion] = useState<AISuggestion | undefined>(initialSuggestion)
  const [feedback, setFeedback] = useState<string | undefined>(initialSuggestion?.user_feedback)
  const [isLoading, setIsLoading] = useState(suggestionStatus === 'pending')
  const [isDismissed, setIsDismissed] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Reset state when memoryId changes (e.g. user saves a second memory)
  useEffect(() => {
    setSuggestion(initialSuggestion)
    setFeedback(initialSuggestion?.user_feedback)
    setIsLoading(suggestionStatus === 'pending')
    setIsDismissed(false)
  }, [memoryId, initialSuggestion, suggestionStatus])

  // Poll for suggestion if pending — extended to 60s with exponential backoff
  useEffect(() => {
    if (suggestionStatus !== 'pending') return

    let attempts = 0
    const maxAttempts = 20 // ~60s total with backoff

    const poll = async () => {
      attempts++
      try {
        const response = await api.getSuggestion(memoryId)
        if (response.success && response.data) {
          setSuggestion(response.data)
          setIsLoading(false)
          return // stop polling
        }
      } catch {
        // Silently fail on polling errors
      }

      if (attempts >= maxAttempts) {
        setIsLoading(false)
        return // stop polling
      }

      // Exponential backoff: 2s, 2s, 2s, 3s, 3s, 4s, 4s, 5s...
      const delay = Math.min(2000 + Math.floor(attempts / 3) * 1000, 5000)
      intervalRef.current = setTimeout(poll, delay)
    }

    intervalRef.current = setTimeout(poll, 2000)

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [memoryId, suggestionStatus])

  const handleFeedback = async (type: 'liked' | 'disliked') => {
    if (feedback) return
    setFeedback(type)
    try {
      await api.updateSuggestionFeedback(memoryId, type)
    } catch {
      // Silently fail — feedback is best-effort
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    onDismiss?.()
  }

  if (isDismissed) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="mt-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30 p-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              AI 说
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-md text-amber-400 dark:text-amber-600 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
            aria-label="关闭"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-3 bg-amber-100 dark:bg-amber-900/20 rounded w-full animate-pulse" />
            <div className="h-3 bg-amber-100 dark:bg-amber-900/20 rounded w-3/4 animate-pulse" />
          </div>
        ) : suggestion ? (
          <>
            <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed mb-4">
              {suggestion.content}
            </p>

            {/* Feedback buttons */}
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
                <span className="text-xs text-amber-500 dark:text-amber-400 ml-1">
                  已收藏
                </span>
              )}
              {feedback === 'disliked' && (
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                  已反馈
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            AI 暂时没想好，稍后再来看看吧~
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
