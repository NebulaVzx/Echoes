'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Conversation, Message } from '@/types/chat'
import ChatHeader from './chat-header'
import ChatMessageList from './chat-message-list'
import ChatInput from './chat-input'
import ChatHistoryList from './chat-history-list'

interface ChatSidebarProps {
  isOpen: boolean
  onClose: () => void
  messages: Message[]
  isLoading: boolean
  onSendMessage: (content: string) => void
  conversations: Conversation[]
  activeConversationId: string | null
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
  onDeleteConversation: (id: string) => void
}

export default function ChatSidebar({
  isOpen,
  onClose,
  messages,
  isLoading,
  onSendMessage,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: ChatSidebarProps) {
  const [showHistory, setShowHistory] = useState(false)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 z-40 sm:hidden"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
            className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white dark:bg-gray-800 border-l border-gray-100 dark:border-gray-700 z-50 flex flex-col shadow-xl"
            data-testid="chat-sidebar"
          >
            <ChatHeader
              onClose={onClose}
              onToggleHistory={() => setShowHistory(!showHistory)}
              onNewChat={() => { onNewConversation(); setShowHistory(false); }}
            />

            {showHistory ? (
              <ChatHistoryList
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelect={(id) => { onSelectConversation(id); setShowHistory(false); }}
                onNewChat={() => { onNewConversation(); setShowHistory(false); }}
                onDelete={onDeleteConversation}
                onClose={() => setShowHistory(false)}
              />
            ) : (
              <>
                <ChatMessageList messages={messages} isLoading={isLoading} />
                <ChatInput onSend={onSendMessage} isLoading={isLoading} />
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
