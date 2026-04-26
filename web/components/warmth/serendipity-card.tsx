'use client'

import { useEffect, useState } from 'react'
import { api, Memory } from '@/lib/api'
import { Calendar, X } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

interface SerendipityData {
  memory: Memory
  memories_since: number
  years_ago: number
}

export default function SerendipityCard() {
  const [data, setData] = useState<SerendipityData | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const today = new Date().toDateString()
    const dismissedDate = localStorage.getItem('serendipity_dismissed')
    if (dismissedDate === today) {
      setDismissed(true)
      return
    }

    api.getSerendipity().then((res) => {
      if (res.success && res.data?.memory) {
        setData(res.data)
      }
    }).catch(() => {})
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('serendipity_dismissed', new Date().toDateString())
  }

  const handleFavorite = () => {
    if (!data) return
    const favorites = JSON.parse(localStorage.getItem('favorite_memories') || '[]')
    if (!favorites.includes(data.memory.id)) {
      favorites.push(data.memory.id)
      localStorage.setItem('favorite_memories', JSON.stringify(favorites))
    }
  }

  if (dismissed || !data) return null

  const preview = data.memory.text_content
    ? data.memory.text_content.slice(0, 120) + (data.memory.text_content.length > 120 ? '...' : '')
    : data.memory.link_title || '一段记忆'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="mb-5 p-4 rounded-xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {data.years_ago === 1 ? '一年前的今天' : `${data.years_ago}年前的今天`}
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <Link href={`/memory/${data.memory.id}`}>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            "{preview}"
          </p>
        </Link>
        <div className="flex items-center justify-between">
          <span className="text-xs text-amber-600/70 dark:text-amber-400/70">
            从那以后，你还保存了 {data.memories_since} 条记忆
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleFavorite}
              className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
            >
              收藏这条回忆
            </button>
            <Link
              href={`/memory/${data.memory.id}`}
              className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
            >
              查看详情 →
            </Link>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
