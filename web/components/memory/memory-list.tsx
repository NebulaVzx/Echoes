'use client'

import { motion } from 'framer-motion'
import MemoryCard from './memory-card'
import { Memory } from '@/lib/api'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
}

interface MemoryListProps {
  memories: Memory[]
  hasMore?: boolean
  onLoadMore?: () => void
  isLoadingMore?: boolean
  tagColors?: Record<string, string>
  onTagClick?: (tag: string) => void
}

export default function MemoryList({ memories, hasMore, onLoadMore, isLoadingMore, tagColors, onTagClick }: MemoryListProps) {
  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-5"
      >
        {memories.map((memory) => (
          <motion.div key={memory.id} variants={itemVariants}>
            <MemoryCard memory={memory} tagColors={tagColors} onTagClick={onTagClick} />
          </motion.div>
        ))}
      </motion.div>

      {onLoadMore && (
        <div className="flex justify-center py-6">
          {hasMore ? (
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="px-5 py-2.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? '加载中...' : '加载更多'}
            </button>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500">已加载全部</span>
          )}
        </div>
      )}
    </>
  )
}
