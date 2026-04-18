export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="text-center animate-fade-in">
        <h1 className="text-4xl font-semibold text-gray-900 dark:text-gray-50 mb-4">
          Echoes
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 mb-2">
          拾忆 - 个人语义搜索引擎
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          拾起遗落的记忆
        </p>
      </div>

      <div className="mt-12 grid gap-4 animate-slide-up">
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
            Sprint 0 完成
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            基础设施搭建完成 - Docker Compose, PostgreSQL, Redis, MinIO
          </p>
        </div>
      </div>
    </main>
  )
}
