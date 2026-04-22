'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Message, Conversation, SendMessageRequest } from '@/types/chat'
import { api } from '@/lib/api'

interface ChatContextType {
  isOpen: boolean
  openChat: () => void
  closeChat: () => void
  toggleChat: () => void
  messages: Message[]
  isLoading: boolean
  sendMessage: (content: string) => Promise<void>
  conversations: Conversation[]
  activeConversationId: string | null
  selectConversation: (id: string) => Promise<void>
  newConversation: () => void
  deleteConversation: (id: string) => Promise<void>
  isConversationsLoading: boolean
}

const ChatContext = createContext<ChatContextType | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isConversationsLoading, setIsConversationsLoading] = useState(false)

  const openChat = useCallback(() => setIsOpen(true), [])
  const closeChat = useCallback(() => setIsOpen(false), [])
  const toggleChat = useCallback(() => setIsOpen(prev => !prev), [])

  const loadConversations = useCallback(async () => {
    setIsConversationsLoading(true)
    try {
      const response = await api.listConversations()
      if (response.success && response.data) {
        setConversations(response.data.conversations)
      }
    } catch (err) {
      console.error('Failed to load conversations:', err)
    } finally {
      setIsConversationsLoading(false)
    }
  }, [])

  const selectConversation = useCallback(async (id: string) => {
    setActiveConversationId(id)
    setIsLoading(true)
    try {
      const response = await api.getMessages(id)
      if (response.success && response.data) {
        setMessages(response.data.messages)
      }
    } catch (err) {
      console.error('Failed to load messages:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const newConversation = useCallback(() => {
    setActiveConversationId(null)
    setMessages([])
  }, [])

  const deleteConversation = useCallback(async (id: string) => {
    try {
      const response = await api.deleteConversation(id)
      if (response.success) {
        setConversations(prev => prev.filter(c => c.id !== id))
        if (activeConversationId === id) {
          setActiveConversationId(null)
          setMessages([])
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }, [activeConversationId])

  const sendMessage = useCallback(async (content: string) => {
    // Optimistically add user message
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConversationId || '',
      role: 'user',
      content,
      citations: [],
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMessage])
    setIsLoading(true)

    try {
      const request: SendMessageRequest = {
        conversation_id: activeConversationId || undefined,
        content,
      }
      const response = await api.sendMessage(request)
      if (response.success && response.data) {
        const { message, citations } = response.data
        // Update conversation ID if this was a new conversation
        if (!activeConversationId && message.conversation_id) {
          setActiveConversationId(message.conversation_id)
          // Refresh conversation list
          await loadConversations()
        }
        setMessages(prev => [
          ...prev.filter(m => m.id !== tempUserMessage.id),
          { ...message, citations: citations || [] },
        ])
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id))
    } finally {
      setIsLoading(false)
    }
  }, [activeConversationId, loadConversations])

  // Load conversations when chat opens
  const handleOpenChat = useCallback(() => {
    setIsOpen(true)
    loadConversations()
  }, [loadConversations])

  const handleToggleChat = useCallback(() => {
    setIsOpen(prev => {
      if (!prev) {
        loadConversations()
      }
      return !prev
    })
  }, [loadConversations])

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        openChat: handleOpenChat,
        closeChat,
        toggleChat: handleToggleChat,
        messages,
        isLoading,
        sendMessage,
        conversations,
        activeConversationId,
        selectConversation,
        newConversation,
        deleteConversation,
        isConversationsLoading,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}
