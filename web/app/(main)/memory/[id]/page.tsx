'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Lock, Unlock } from 'lucide-react'
import { api, Memory } from '@/lib/api'
import { useAuth } from '@/app/providers/auth-provider'
import RelatedMemories from '@/components/search/related-memories'
import SuggestionDetailSection from '@/components/memory/suggestion-detail-section'
import { Skeleton } from '@/components/ui/skeleton'
import { Toast, ToastContainer } from '@/components/ui/toast'
import { getTagStyle } from '@/components/memory/tag-filter-bar'

function MemoryDetailSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-6">
        {/* Meta skeleton */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
        {/* Title skeleton */}
        <Skeleton className="h-6 w-3/4 mb-4" />
        {/* Content skeleton */}
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-5/6 mb-2" />
        <Skeleton className="h-4 w-4/5 mb-6" />
        {/* Tags skeleton */}
        <div className="flex gap-2 mb-6">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
        {/* Actions skeleton */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-16" />
        </div>
      </div>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function MemoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoading: authLoading, logout } = useAuth()
  const [memory, setMemory] = useState<Memory | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [relatedTags, setRelatedTags] = useState<Record<string, string[]>>({})

  // Toast for delete errors
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type })
  const dismissToast = () => setToast(null)

  const memoryId = params.id as string

  useEffect(() => {
    if (!memoryId) return

    const loadMemory = async () => {
      try {
        setIsLoading(true)
        const response = await api.getMemory(memoryId)
        if (response.success && response.data) {
          setMemory(response.data)
          // Load related tags for each tag
          if (response.data.tags && response.data.tags.length > 0) {
            const related: Record<string, string[]> = {}
            await Promise.all(
              response.data.tags.map(async (tag) => {
                try {
                  const resp = await api.getRelatedTags(tag)
                  if (resp.success && resp.data) {
                    related[tag] = resp.data.related_tags
                  }
                } catch {
                  // Silently fail
                }
              })
            )
            setRelatedTags(related)
          }
        } else {
          setError('记忆不存在')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setIsLoading(false)
      }
    }

    loadMemory()
  }, [memoryId])

  // Poll for processing status updates
  useEffect(() => {
    if (!memory || (memory.processing_status !== 'pending' && memory.processing_status !== 'processing')) return

    const interval = setInterval(async () => {
      try {
        const response = await api.getMemory(memoryId)
        if (response.success && response.data) {
          setMemory(response.data)
          if (response.data.processing_status !== 'pending' && response.data.processing_status !== 'processing') {
            clearInterval(interval)
          }
        }
      } catch {
        // Silently fail on polling errors
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [memory?.processing_status, memoryId])

  const handleDelete = async () => {
    if (!confirm('确定要删除这条记忆吗？')) return

    setIsDeleting(true)
    try {
      const response = await api.deleteMemory(memoryId)
      if (response.success) {
        router.push('/')
      } else {
        showToast(response.error?.message || '删除失败', 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSeal = async () => {
    // Default seal for 30 days from detail page
    const d = new Date()
    d.setDate(d.getDate() + 30)
    const res = await api.sealMemory(memoryId, d.toISOString())
    if (res.success) {
      setMemory(prev => prev ? { ...prev, sealed_until: d.toISOString() } : prev)
    }
  }

  const handleUnseal = async () => {
    const res = await api.unsealMemory(memoryId)
    if (res.success) {
      setMemory(prev => prev ? { ...prev, sealed_until: undefined } : prev)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="mx-auto max-w-content-detail px-4 py-6 min-h-[50vh]">
        <MemoryDetailSkeleton />
      </div>
    )
  }

  if (error || !memory) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-content-detail px-4 py-12 text-center min-h-[50vh]"
      >
        <p className="text-red-600 dark:text-red-400 mb-4">{error || '记忆不存在'}</p>
        <Link href="/" className="text-gray-900 dark:text-gray-100 hover:underline text-sm btn-scale inline-block">
          返回首页
        </Link>
      </motion.div>
    )
  }

  const isLink = memory.content_type === 'link'

  return (
    <>
      <ToastContainer>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
        )}
      </ToastContainer>

      {/* Content — Header/nav provided by AppShell */}
      <div className="mx-auto max-w-content-detail px-4 py-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-6">
          {/* Meta */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              {isLink ? (
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
              )}
              <span className="text-xs text-gray-400 dark:text-gray-500">{isLink ? '链接' : '文字'}</span>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(memory.created_at)}</span>
          </div>

          {/* Content */}
          {isLink ? (
            <div className="mb-6">
              {memory.link_title && (
                <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{memory.link_title}</h1>
              )}
              <a
                href={memory.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 dark:text-blue-400 hover:underline break-all"
              >
                {memory.link_url}
              </a>
              {memory.link_summary && (
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{memory.link_summary}</p>
              )}
            </div>
          ) : (
            <div className="mb-6">
              <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{memory.text_content}</p>
            </div>
          )}

          {/* Processing status */}
          {memory.processing_status === 'pending' && (
            <div className="mb-6 flex items-center gap-1.5 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-md">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-xs text-yellow-600 dark:text-yellow-400">处理中 — 链接抓取和标签生成正在进行</span>
            </div>
          )}
          {memory.processing_status === 'failed' && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/10 rounded-md">
              <span className="text-xs text-red-600 dark:text-red-400">处理失败</span>
            </div>
          )}

          {/* Tags */}
          {memory.tags && memory.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {memory.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Note */}
          {memory.note && (
            <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">备注</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{memory.note}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Link
              href="/"
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors btn-scale"
            >
              返回
            </Link>
            {memory.sealed_until ? (
              <button
                onClick={handleUnseal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
              >
                <Unlock className="w-4 h-4" />
                解除封印（{new Date(memory.sealed_until).toLocaleDateString('zh-CN')} 解锁）
              </button>
            ) : (
              <button
                onClick={handleSeal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <Lock className="w-4 h-4" />
                封印这段记忆
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50 btn-scale"
            >
              {isDeleting ? '删除中...' : '删除'}
            </button>
          </div>

          {/* Related Tags */}
          {Object.keys(relatedTags).length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">相关标签</p>
              <div className="space-y-2">
                {Object.entries(relatedTags).map(([tag, related]) =>
                  related.length > 0 ? (
                    <div key={tag} className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{tag}:</span>
                      {related.map((r) => (
                        <Link
                          key={r}
                          href={`/?tags=${encodeURIComponent(r)}`}
                          className={`inline-flex px-2 py-0.5 text-xs rounded-full transition-colors hover:opacity-80 ${getTagStyle(undefined, false)}`}
                        >
                          {r}
                        </Link>
                      ))}
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* AI Suggestion */}
          <SuggestionDetailSection memoryId={memoryId} />

          {/* Related memories */}
          <RelatedMemories memoryId={memoryId} />
        </div>
      </div>
    </>
  )
}
