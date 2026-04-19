'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/app/providers/auth-provider'
import { useTheme } from '@/app/providers/theme-provider'
import { api, Memory } from '@/lib/api'
import Logo from '@/components/logo'
import Link from 'next/link'
import CreateMemoryForm from '@/components/memory/create-memory-form'
import MemoryCard from '@/components/memory/memory-card'

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

export default function HomePage() {
  const { user, isLoading: authLoading, logout } = useAuth()
  const [memories, setMemories] = useState<Memory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadMemories = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await api.listMemories({ page: 1, limit: 20 })
      if (response.success && response.data) {
        setMemories(response.data.memories)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMemories()
  }, [loadMemories])

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={28} className="text-gray-900 dark:text-gray-100" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Echoes</h1>
            <span className="text-xs text-gray-400 dark:text-gray-500">拾忆</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user && (
              <div className="flex items-center gap-3">
                <Link
                  href="/settings"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  设置
                </Link>
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

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Create form */}
        <div className="mb-8">
          <CreateMemoryForm onSuccess={loadMemories} />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Timeline */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              时间轴
            </h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {memories.length} 条记忆
            </span>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">
              加载中...
            </div>
          ) : memories.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-gray-300 dark:text-gray-600 mb-3">
                <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                还没有记忆，上方创建第一条吧
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {memories.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
