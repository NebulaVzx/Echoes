'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { api, SearchResult } from '@/lib/api'
import { useAuth } from '@/app/providers/auth-provider'
import Logo from '@/components/logo'
import Link from 'next/link'
import MemoryCard from '@/components/memory/memory-card'
import SearchInput from '@/components/search/search-input'
import ThemeToggle from '@/components/theme-toggle'
import EmptyState from '@/components/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

function SearchSkeleton() {
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
}

function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const { user } = useAuth()

  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!query) return

    const abortController = new AbortController()

    const doSearch = async () => {
      setIsLoading(true)
      setError('')
      try {
        const response = await api.searchMemories({ q: query, limit: 20 }, abortController.signal)
        if (abortController.signal.aborted) return
        if (response.success && response.data) {
          setResults(response.data.results)
        } else {
          setError(response.error?.message || '搜索失败')
        }
      } catch (err) {
        if (abortController.signal.aborted) return
        setError(err instanceof Error ? err.message : '搜索失败')
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    doSearch()

    return () => {
      abortController.abort()
    }
  }, [query])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Query display */}
      <div className="mb-6">
        <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          &quot;{query}&quot; 的搜索结果
        </h1>
        {!isLoading && results.length > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            找到 {results.length} 条相关记忆
          </p>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <SearchSkeleton />
      ) : error ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center py-12"
        >
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </motion.div>
      ) : results.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          }
          title="没有找到相关记忆，换个关键词试试？"
        />
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-5"
        >
          {results.map((result) => (
            <motion.div key={result.id} variants={itemVariants}>
              <div>
                <MemoryCard memory={result} />
                <div className="mt-1.5 text-right">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    相关度 {Math.round(result.similarity * 100)}%
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
          <div className="flex items-center gap-1 flex-shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <Suspense fallback={<SearchSkeleton />}>
        <SearchResults />
      </Suspense>
    </main>
  )
}
