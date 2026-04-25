'use client'

import { Conversation } from '@/types/chat'
import { Plus, ArrowLeft } from 'lucide-react'
import ChatHistoryItem from './chat-history-item'

interface ChatHistoryListProps {
  conversations: Conversation[]
  activeConversationId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function ChatHistoryList({
  conversations,
  activeConversationId,
  onSelect,
  onNewChat,
  onDelete,
  onClose,
}: ChatHistoryListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">历史对话</span>
        <button
          onClick={onNewChat}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
            暂无历史对话
          </div>
        ) : (
          conversations.map((conv) => (
            <ChatHistoryItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeConversationId}
              onSelect={() => onSelect(conv.id)}
              onDelete={() => onDelete(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
