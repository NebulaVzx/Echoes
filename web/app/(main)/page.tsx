'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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
import { Sparkles, Star } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import UnlockCeremony from '@/components/warmth/unlock-ceremony'
import SerendipityCard from '@/components/warmth/serendipity-card'
import EchoCard from '@/components/echo/echo-card'
import SelectionBar from '@/components/memory/selection-bar'
import WeaveModal from '@/components/weave/weave-modal'

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

  // Starred filter state
  const [starredOnly, setStarredOnly] = useState(false)

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [weaveModalOpen, setWeaveModalOpen] = useState(false)
  const lastSelectedIndexRef = useRef<number | null>(null)

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
        starred: starredOnly ? true : undefined,
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
  }, [limit, selectedTags, starredOnly])

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

  // Update URL to reflect current tag selection and starred filter
  const updateURL = useCallback((tags: string[], starred: boolean) => {
    const params = new URLSearchParams()
    tags.forEach(t => params.append('tags', t))
    if (starred) params.set('starred', 'true')
    const query = params.toString()
    router.replace(query ? `/?${query}` : '/', { scroll: false })
  }, [router])

  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags(prev => {
      const next = prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
      updateURL(next, starredOnly)
      return next
    })
  }, [updateURL, starredOnly])

  const handleClearAllTags = useCallback(() => {
    setSelectedTags([])
    updateURL([], starredOnly)
  }, [updateURL, starredOnly])

  const handleTagClickFromCard = useCallback((tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) return prev
      const next = [...prev, tag]
      updateURL(next, starredOnly)
      return next
    })
  }, [updateURL, starredOnly])

  const handleStarredToggle = useCallback(() => {
    setStarredOnly(prev => {
      const next = !prev
      updateURL(selectedTags, next)
      return next
    })
  }, [updateURL, selectedTags])

  // Multi-select handlers
  const handleSelectToggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    setSelectionMode(true)
  }, [])

  const handleSelectRange = useCallback((startId: string, endId: string) => {
    const startIdx = memories.findIndex(m => m.id === startId)
    const endIdx = memories.findIndex(m => m.id === endId)
    if (startIdx === -1 || endIdx === -1) return
    const [min, max] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (let i = min; i <= max; i++) {
        next.add(memories[i].id)
      }
      return next
    })
    setSelectionMode(true)
  }, [memories])

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setSelectionMode(false)
    lastSelectedIndexRef.current = null
  }, [])

  const handleWeaveClick = useCallback(() => {
    setWeaveModalOpen(true)
  }, [])

  const handleWeaveSuccess = useCallback(() => {
    handleClearSelection()
    showToast('编织完成', 'success')
    loadMemories(1, false)
  }, [handleClearSelection, loadMemories])

  // Sync selectedTags and starred from URL query params on mount / external navigation
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
    const starredParam = searchParams.get('starred')
    setStarredOnly(starredParam === 'true')
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

  // Poll for processing status updates — adaptive interval based on content type.
  // text: 3s (fast), link: 5s (web fetch), file: 10s (download + extract + vectorize).
  useEffect(() => {
    const processing = memories.filter(
      (m) => m.processing_status === 'pending' || m.processing_status === 'processing'
    )
    if (processing.length === 0) return

    const hasFile = processing.some((m) => m.content_type === 'file')
    const hasLink = processing.some((m) => m.content_type === 'link')
    const intervalMs = hasFile ? 10000 : hasLink ? 5000 : 3000

    const interval = setInterval(() => {
      loadMemories(page, false)
    }, intervalMs)

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
        {/* AI Chat — mobile floating button (desktop: use Cmd+K or sidebar) */}
        {user && (
          <button
            onClick={toggleChat}
            className="fixed bottom-6 right-6 z-40 md:hidden flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 btn-scale"
            aria-label="AI 助手"
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-medium">AI</span>
          </button>
        )}

        {/* Warmth cards — compact row */}
        <div className="space-y-3 mb-8">
          <UnlockCeremony />
          <SerendipityCard />
          <EchoCard />
        </div>

        {/* Create form */}
        <div className="mb-6">
          <CreateMemoryForm onSuccess={() => loadMemories(1, false)} />
        </div>

        {/* Tag Filter + Starred Filter */}
        <div className="space-y-3 mb-4">
          {allTags.length > 0 && (
            <TagFilterBar
              tags={allTags}
              selectedTags={selectedTags}
              onTagToggle={handleTagToggle}
              onClearAll={handleClearAllTags}
            />
          )}
          <div className="flex items-center gap-2">
            <Switch
              checked={starredOnly}
              onCheckedChange={handleStarredToggle}
              size="sm"
            />
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">只看星标</span>
          </div>
        </div>

        {/* Selection bar */}
        <SelectionBar
          selectedCount={selectedIds.size}
          onClear={handleClearSelection}
          onWeave={handleWeaveClick}
        />

        {/* Timeline */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {starredOnly
                ? (selectedTags.length > 0 ? `星标 + 标签: ${selectedTags.join(', ')}` : '星标记忆')
                : (selectedTags.length > 0 ? `已筛选: ${selectedTags.join(', ')}` : '时间轴')}
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
              title={
                starredOnly
                  ? (selectedTags.length > 0 ? '没有匹配该标签的星标记忆' : '还没有星标记忆')
                  : (selectedTags.length > 0 ? '没有匹配该标签的记忆' : '还没有记忆，上方创建第一条吧')
              }
            />
          ) : (
            <MemoryList
              memories={memories}
              hasMore={paginationMode === 'load_more' ? hasMore : undefined}
              onLoadMore={paginationMode === 'load_more' ? handleLoadMore : undefined}
              isLoadingMore={isLoadingMore}
              tagColors={tagColors}
              onTagClick={handleTagClickFromCard}
              selectable={true}
              selectedIds={selectedIds}
              onSelectToggle={handleSelectToggle}
              selectionMode={selectionMode}
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

      {/* Weave Modal */}
      <WeaveModal
        open={weaveModalOpen}
        onClose={() => setWeaveModalOpen(false)}
        selectedIds={Array.from(selectedIds)}
        memories={memories.filter(m => selectedIds.has(m.id))}
        onSuccess={handleWeaveSuccess}
      />

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
