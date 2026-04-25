'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/app/providers/auth-provider'
import { ChatProvider, useChat } from '@/app/providers/chat-provider'
import { api, Memory } from '@/lib/api'
import Logo from '@/components/logo'
import Link from 'next/link'
import ThemeToggle from '@/components/theme-toggle'
import CreateMemoryForm from '@/components/memory/create-memory-form'
import MemoryList from '@/components/memory/memory-list'
import SearchInput from '@/components/search/search-input'
import EmptyState from '@/components/empty-state'
import ChatSidebar from '@/components/chat/chat-sidebar'
import Pagination from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { Toast, ToastContainer } from '@/components/ui/toast'
import { Sparkles } from 'lucide-react'

function TimelineSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-3" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HomePageWrapper() {
  return (
    <ChatProvider>
      <HomePage />
    </ChatProvider>
  )
}

function HomePage() {
  const { user, isLoading: authLoading, logout } = useAuth()
  const {
    isOpen,
    closeChat,
    toggleChat,
    messages,
    isLoading: chatLoading,
    sendMessage,
    conversations,
    activeConversationId,
    selectConversation,
    newConversation,
    deleteConversation,
  } = useChat()
  const [memories, setMemories] = useState<Memory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Pagination state
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [paginationMode, setPaginationMode] = useState<'load_more' | 'page_numbers'>('load_more')

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type })
  const dismissToast = () => setToast(null)

  const loadMemories = useCallback(async (targetPage: number = 1, append: boolean = false) => {
    try {
      if (targetPage === 1) setIsLoading(true)
      else setIsLoadingMore(true)

      const response = await api.listMemories({ page: targetPage, limit })
      if (response.success && response.data) {
        const data = response.data
        if (append) {
          setMemories(prev => [...prev, ...data.memories])
        } else {
          setMemories(data.memories)
        }
        setHasMore(data.has_more)
        setTotal(data.total)
        setPage(targetPage)
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '加载失败', 'error')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [limit])

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return
    loadMemories(page + 1, true)
  }, [hasMore, isLoadingMore, page, loadMemories])

  const handlePageChange = useCallback((newPage: number) => {
    loadMemories(newPage, false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [loadMemories])

  // Load pagination mode from user settings on mount
  useEffect(() => {
    const loadPaginationPreference = async () => {
      try {
        const response = await api.getSettings()
        if (response.success && response.data?.pagination_mode) {
          setPaginationMode(response.data.pagination_mode)
        }
      } catch {
        // Ignore settings load failure; default to load_more
      }
    }
    loadPaginationPreference()
  }, [])

  useEffect(() => {
    loadMemories(1, false)
  }, [loadMemories])

  // Poll for processing status updates — when any memory is pending/processing,
  // refresh the list every 3 seconds until all are completed/failed.
  useEffect(() => {
    const hasProcessing = memories.some(
      (m) => m.processing_status === 'pending' || m.processing_status === 'processing'
    )
    if (!hasProcessing) return

    const interval = setInterval(() => {
      loadMemories(page, false)
    }, 3000)

    return () => clearInterval(interval)
  }, [memories, page, loadMemories])

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Logo size={28} className="text-gray-900 dark:text-gray-100" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Echoes</h1>
            <span className="text-xs text-gray-400 dark:text-gray-500">拾忆</span>
          </div>
          <SearchInput />
          <div className="flex items-center gap-1 flex-shrink-0">
            {user && (
              <button
                onClick={toggleChat}
                className="flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors btn-scale"
                title="Echo Assistant"
                aria-label="AI 助手"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">AI</span>
              </button>
            )}
            <ThemeToggle />
            {user && (
              <div className="flex items-center gap-1 ml-1">
                <Link
                  href="/settings"
                  className="flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors btn-scale"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="hidden sm:inline">设置</span>
                </Link>
                <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
                <span className="px-2 text-sm text-gray-600 dark:text-gray-300 hidden sm:inline max-w-[120px] truncate">
                  {user.username || user.email}
                </span>
                <button
                  onClick={logout}
                  className="flex items-center px-2.5 h-9 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors btn-scale"
                >
                  <svg className="w-4 h-4 sm:mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  <span className="hidden sm:inline">退出</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <ToastContainer>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
        )}
      </ToastContainer>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Create form */}
        <div className="mb-10">
          <CreateMemoryForm onSuccess={() => loadMemories(1, false)} />
        </div>

        {/* Timeline */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              时间轴
            </h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {total > 0 ? `${total} 条记忆` : `${memories.length} 条记忆`}
            </span>
          </div>

          {isLoading ? (
            <TimelineSkeleton />
          ) : memories.length === 0 ? (
            <EmptyState
              icon={
                <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="还没有记忆，上方创建第一条吧"
            />
          ) : (
            <MemoryList
              memories={memories}
              hasMore={paginationMode === 'load_more' ? hasMore : undefined}
              onLoadMore={paginationMode === 'load_more' ? handleLoadMore : undefined}
              isLoadingMore={isLoadingMore}
            />
          )}

          {/* Pagination component for page_numbers mode */}
          {paginationMode === 'page_numbers' && total > 0 && (
            <div className="mt-6">
              <Pagination
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(total / limit))}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </div>

      {user && (
        <ChatSidebar
          isOpen={isOpen}
          onClose={closeChat}
          messages={messages}
          isLoading={chatLoading}
          onSendMessage={sendMessage}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={selectConversation}
          onNewConversation={newConversation}
          onDeleteConversation={deleteConversation}
        />
      )}
    </main>
  )
}
