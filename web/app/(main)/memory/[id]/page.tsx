'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, Memory } from '@/lib/api'
import { useAuth } from '@/app/providers/auth-provider'
import { useTheme } from '@/app/providers/theme-provider'
import Logo from '@/components/logo'
import RelatedMemories from '@/components/search/related-memories'
import SearchInput from '@/components/search/search-input'
import { Toast, ToastContainer } from '@/components/ui/toast'

function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      aria-label={resolvedTheme === 'dark' ? '切换到亮色模式' : '切换到暗黑模式'}
    >
      {resolvedTheme === 'dark' ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      )}
    </button>
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
    if (!memory || memory.processing_status !== 'pending') return

    const interval = setInterval(async () => {
      try {
        const response = await api.getMemory(memoryId)
        if (response.success && response.data) {
          setMemory(response.data)
          if (response.data.processing_status !== 'pending') {
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

  if (authLoading || isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </main>
    )
  }

  if (error || !memory) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || '记忆不存在'}</p>
          <Link href="/" className="text-gray-900 dark:text-gray-100 hover:underline text-sm">
            返回首页
          </Link>
        </div>
      </main>
    )
  }

  const isLink = memory.content_type === 'link'

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ToastContainer>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
        )}
      </ToastContainer>

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Logo size={28} className="text-gray-900 dark:text-gray-100" />
            <Link href="/" className="text-lg font-semibold text-gray-900 dark:text-gray-50 hover:opacity-80 transition-opacity">
              Echoes
            </Link>
          </div>
          <SearchInput />
          <div className="flex items-center gap-3 flex-shrink-0">
            <ThemeToggle />
            {user && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-300 hidden sm:inline">
                  {user.username || user.email}
                </span>
                <button
                  onClick={logout}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  退出
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
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
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              返回
            </Link>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-50"
            >
              {isDeleting ? '删除中...' : '删除'}
            </button>
          </div>

          {/* Related memories */}
          <RelatedMemories memoryId={memoryId} />
        </div>
      </div>
    </main>
  )
}
