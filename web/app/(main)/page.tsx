'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/app/providers/auth-provider'
import { api, Memory } from '@/lib/api'
import Logo from '@/components/logo'
import Link from 'next/link'
import ThemeToggle from '@/components/theme-toggle'
import CreateMemoryForm from '@/components/memory/create-memory-form'
import MemoryCard from '@/components/memory/memory-card'
import { Toast, ToastContainer } from '@/components/ui/toast'

export default function HomePage() {
  const { user, isLoading: authLoading, logout } = useAuth()
  const [memories, setMemories] = useState<Memory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type })
  const dismissToast = () => setToast(null)

  const loadMemories = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await api.listMemories({ page: 1, limit: 20 })
      if (response.success && response.data) {
        setMemories(response.data.memories)
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '加载失败', 'error')
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
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={28} className="text-gray-900 dark:text-gray-100" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Echoes</h1>
            <span className="text-xs text-gray-400 dark:text-gray-500">拾忆</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {user && (
              <div className="flex items-center gap-1 ml-1">
                <Link
                  href="/settings"
                  className="flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                  className="flex items-center px-2.5 h-9 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
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
          <CreateMemoryForm onSuccess={loadMemories} />
        </div>

        {/* Timeline */}
        <div>
          <div className="flex items-center justify-between mb-5">
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
            <div className="flex flex-col gap-5">
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
