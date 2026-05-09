'use client'

import { useRouter } from 'next/navigation'
import { PenLine, X } from 'lucide-react'

interface SelectionBarProps {
  selectedCount: number
  onClear: () => void
  onWeave: () => void
}

export default function SelectionBar({ selectedCount, onClear, onWeave }: SelectionBarProps) {
  const router = useRouter()

  if (selectedCount === 0) return null

  return (
    <div className="sticky top-0 z-30 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-700 px-4 py-2.5 flex items-center justify-between animate-in slide-in-from-top">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          已选择 {selectedCount} 条记忆
        </span>
        <button
          onClick={onClear}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          清除
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onWeave}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors"
        >
          <PenLine className="w-3.5 h-3.5" />
          编织
        </button>
      </div>
    </div>
  )
}
