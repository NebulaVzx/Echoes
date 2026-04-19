'use client'

import { useAuth } from '@/app/providers/auth-provider'
import Logo from '@/components/logo'

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
