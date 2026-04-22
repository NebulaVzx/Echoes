'use client'

import { motion } from 'framer-motion'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
}

export default function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="text-center py-16"
    >
      <div className="text-gray-300 dark:text-gray-600 mb-3">
        {icon}
      </div>
      <p className="text-sm text-gray-400 dark:text-gray-500">
        {title}
      </p>
      {description && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {description}
        </p>
      )}
    </motion.div>
  )
}
