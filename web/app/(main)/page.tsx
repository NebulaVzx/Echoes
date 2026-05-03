'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/app/providers/auth-provider'
import { ChatProvider, useChat } from '@/app/providers/chat-provider'
import { api, Memory } from '@/lib/api'
// Logo, ThemeToggle, SearchInput, Link removed — now provided by AppShell Header/Sidebar
import CreateMemoryForm from '@/components/memory/create-memory-form'
import MemoryList from '@/components/memory/memory-list'
import TagFilterBar from '@/components/memory/tag-filter-bar'
import EmptyState from '@/components/empty-state'
import ChatSidebar from '@/components/chat/chat-sidebar'
import Pagination from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { Toast, ToastContainer } from '@/components/ui/toast'
import { Sparkles, Clock } from 'lucide-react'
import UnlockCeremony from '@/components/warmth/unlock-ceremony'
import SerendipityCard from '@/components/warmth/serendipity-card'
import DailyReviewCard from '@/components/warmth/daily-review-card'

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
  const searchParams = useSearchParams()
  const router = useRouter()
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

  // Tag filter state
  const [allTags, setAllTags] = useState<{ name: string; count: number; color?: string }[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagColors, setTagColors] = useState<Record<string, string>>({})

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type })
  const dismissToast = () => setToast(null)

  const loadMemories = useCallback(async (targetPage: number = 1, append: boolean = false) => {
    try {
      if (targetPage === 1) setIsLoading(true)
      else setIsLoadingMore(true)

      const response = await api.listMemories({
        page: targetPage,
        limit,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      })
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
  }, [limit, selectedTags])

  // Load tags and tag colors
  const loadTags = useCallback(async () => {
    try {
      const [tagsResponse, settingsResponse] = await Promise.all([
        api.getTags(),
        api.getSettings(),
      ])
      if (tagsResponse.success && tagsResponse.data) {
        const tags = tagsResponse.data.tags
        const colors: Record<string, string> = {}
        if (settingsResponse.success && settingsResponse.data?.tag_metadata) {
          Object.entries(settingsResponse.data.tag_metadata).forEach(([name, meta]) => {
            if (meta.color) colors[name] = meta.color
          })
        }
        setAllTags(tags.map(t => ({ name: t.name, count: t.count, color: colors[t.name] })))
        setTagColors(colors)
      }
    } catch {
      // Silently fail
    }
  }, [])

  // Update URL to reflect current tag selection
  const updateTagURL = useCallback((tags: string[]) => {
    const params = new URLSearchParams()
    tags.forEach(t => params.append('tags', t))
    const query = params.toString()
    router.replace(query ? `/?${query}` : '/', { scroll: false })
  }, [router])

  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags(prev => {
      const next = prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
      updateTagURL(next)
      return next
    })
  }, [updateTagURL])

  const handleClearAllTags = useCallback(() => {
    setSelectedTags([])
    router.replace('/', { scroll: false })
  }, [router])

  const handleTagClickFromCard = useCallback((tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) return prev
      const next = [...prev, tag]
      updateTagURL(next)
      return next
    })
  }, [updateTagURL])

  // Sync selectedTags from URL query params on mount / external navigation
  useEffect(() => {
    const tagsParam = searchParams.getAll('tags')
    if (tagsParam.length > 0) {
      setSelectedTags(tagsParam)
    } else {
      const singleTag = searchParams.get('tag')
      if (singleTag) {
        setSelectedTags([singleTag])
      }
    }
  }, [searchParams])

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return
    loadMemories(page + 1, true)
  }, [hasMore, isLoadingMore, page, loadMemories])

  const handlePageChange = useCallback((newPage: number) => {
    loadMemories(newPage, false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [loadMemories])

  // Load pagination mode and tags from user settings on mount
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
    loadTags()
  }, [loadTags])

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
      <div className="mx-auto max-w-content-timeline px-4 py-6 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    )
  }

  return (
    <>
      <ToastContainer>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
        )}
      </ToastContainer>

      {/* Content — Header, nav, theme provided by AppShell */}
      <div className="mx-auto max-w-content-timeline px-4 py-6">
        {/* Chat toggle — floating button */}
        {user && (
          <button
            onClick={toggleChat}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 btn-scale md:hidden"
            aria-label="AI 助手"
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-medium">AI</span>
          </button>
        )}
        {user && (
          <button
            onClick={toggleChat}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 mb-4 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            aria-label="AI 助手"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI 助手</span>
          </button>
        )}

        {/* Warmth cards */}
        <UnlockCeremony />
        <SerendipityCard />
        <DailyReviewCard />

        {/* Create form */}
        <div className="mb-10">
          <CreateMemoryForm onSuccess={() => loadMemories(1, false)} />
        </div>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <TagFilterBar
            tags={allTags}
            selectedTags={selectedTags}
            onTagToggle={handleTagToggle}
            onClearAll={handleClearAllTags}
          />
        )}

        {/* Timeline */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {selectedTags.length > 0 ? `已筛选: ${selectedTags.join(', ')}` : '时间轴'}
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
              title={selectedTags.length > 0 ? '没有匹配该标签的记忆' : '还没有记忆，上方创建第一条吧'}
            />
          ) : (
            <MemoryList
              memories={memories}
              hasMore={paginationMode === 'load_more' ? hasMore : undefined}
              onLoadMore={paginationMode === 'load_more' ? handleLoadMore : undefined}
              isLoadingMore={isLoadingMore}
              tagColors={tagColors}
              onTagClick={handleTagClickFromCard}
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
    </>
  )
}
