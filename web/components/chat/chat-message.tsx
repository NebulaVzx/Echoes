'use client'

import { Message } from '@/types/chat'
import { MarkdownRenderer } from '@/lib/markdown'
import CitationFooter from './citation-footer'

interface ChatMessageProps {
  message: Message
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-4 py-3`}>
      <div className={`max-w-[85%] ${isUser ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'} rounded-2xl px-4 py-3`}>
        <div className={isUser ? 'text-white' : 'text-gray-900 dark:text-gray-100'}>
          <MarkdownRenderer content={message.content} citations={isUser ? undefined : message.citations} />
        </div>
        {!isUser && message.citations && message.citations.length > 0 && (
          <CitationFooter citations={message.citations} />
        )}
      </div>
    </div>
  )
}
