'use client'

import { useRef, useEffect } from 'react'
import { Message } from '@/types/chat'
import ChatMessage from './chat-message'
import TypingIndicator from './typing-indicator'

interface ChatMessageListProps {
  messages: Message[]
  isLoading: boolean
}

export default function ChatMessageList({ messages, isLoading }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className="flex-1 overflow-y-auto">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
          <p className="text-sm">开始一段新对话吧</p>
        </div>
      ) : (
        <div className="py-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
