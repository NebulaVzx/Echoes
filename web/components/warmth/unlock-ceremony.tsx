'use client'

import { useEffect, useState } from 'react'
import { api, Memory } from '@/lib/api'
import { Clock, X } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

export default function UnlockCeremony() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    api.getRecentlyUnsealed().then((res) => {
      if (res.success && res.data?.memories) {
        setMemories(res.data.memories)
      }
    }).catch(() => {})
  }, [])

  const handleDismiss = () => {
    setCurrentIndex(prev => prev + 1)
  }

  const memory = memories[currentIndex]
  if (!memory) return null

  const preview = memory.text_content
    ? memory.text_content.slice(0, 150) + (memory.text_content.length > 150 ? '...' : '')
    : memory.link_title || '一段被封印的记忆'

  return (
    <AnimatePresence>
      <motion.div
        key={memory.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mb-5 p-5 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-100 dark:border-violet-800/30"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <span className="text-base font-medium text-violet-900 dark:text-violet-200">
              ⏳ 一段被封印的记忆已解锁
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className="text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
          {preview}
        </p>

        <Link
          href={`/memory/${memory.id}`}
          className="inline-flex items-center px-4 py-2 text-sm bg-violet-600 dark:bg-violet-500 text-white rounded-lg hover:bg-violet-700 dark:hover:bg-violet-400 transition-colors"
        >
          打开看看
        </Link>
      </motion.div>
    </AnimatePresence>
  )
}
