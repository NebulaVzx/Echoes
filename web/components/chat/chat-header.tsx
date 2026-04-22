'use client'

import { X, History, Sparkles } from 'lucide-react'

interface ChatHeaderProps {
  onClose: () => void
  onToggleHistory: () => void
  onNewChat: () => void
}

export default function ChatHeader({ onClose, onToggleHistory, onNewChat }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <span className="font-medium text-gray-900 dark:text-gray-100">Echo Assistant</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onNewChat}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          title="新对话"
        >
          <Sparkles className="w-4 h-4" />
        </button>
        <button
          onClick={onToggleHistory}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          title="历史对话"
        >
          <History className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          title="关闭"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
