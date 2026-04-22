'use client'

import { Conversation } from '@/types/chat'
import { MessageSquare, Trash2 } from 'lucide-react'

interface ChatHistoryItemProps {
  conversation: Conversation
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}

export default function ChatHistoryItem({ conversation, isActive, onSelect, onDelete }: ChatHistoryItemProps) {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
      }`}
    >
      <MessageSquare className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
      <span className="flex-1 text-sm truncate">{conversation.title}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all"
        title="删除对话"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
