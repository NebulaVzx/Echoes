'use client'

import { useAuth } from '@/app/providers/auth-provider'
import { useTheme } from '@/app/providers/theme-provider'
import Logo from '@/components/logo'

function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      aria-label={resolvedTheme === 'dark' ? '切换到亮色模式' : '切换到暗黑模式'}
      title={resolvedTheme === 'dark' ? '切换到亮色模式' : '切换到暗黑模式'}
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

export default function Home() {
  const { user, isLoading, logout } = useAuth()

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={32} className="text-gray-900 dark:text-gray-100" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">Echoes</h1>
            <span className="text-sm text-gray-400 dark:text-gray-500">拾忆</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {user.username || user.email}
                </span>
                <button
                  onClick={logout}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center animate-fade-in">
          <h2 className="text-4xl font-semibold text-gray-900 dark:text-gray-50 mb-4">
            Echoes
          </h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-2">
            拾忆 - 个人语义搜索引擎
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            拾起遗落的记忆
          </p>
        </div>

        <div className="mt-12 grid gap-4 animate-slide-up max-w-lg mx-auto">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
              Sprint 1 核心认证链路已完成
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              用户注册/登录、JWT Token 体系、Gateway 认证中间件、前端路由保护
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
