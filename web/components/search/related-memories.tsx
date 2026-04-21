'use client'

import { useEffect, useState } from 'react'
import { api, SearchResult } from '@/lib/api'
import MemoryCard from '@/components/memory/memory-card'

interface RelatedMemoriesProps {
  memoryId: string
}

export default function RelatedMemories({ memoryId }: RelatedMemoriesProps) {
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadRelated = async () => {
      try {
        const response = await api.getRelatedMemories(memoryId, { limit: 3 })
        if (response.success && response.data) {
          setResults(response.data.results)
        }
      } catch {
        // Silently fail — related memories are non-critical
      } finally {
        setIsLoading(false)
      }
    }

    loadRelated()
  }, [memoryId])

  if (isLoading) {
    return (
      <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
          你可能还感兴趣
        </h3>
        <div className="text-sm text-gray-400 dark:text-gray-500">加载中...</div>
      </div>
    )
  }

  if (results.length === 0) {
    return null
  }

  return (
    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
        你可能还感兴趣
      </h3>
      <div className="flex flex-col gap-5">
        {results.map((result) => (
          <div key={result.id}>
            <MemoryCard memory={result} />
            <div className="mt-1.5 text-right">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                相关度 {Math.round(result.similarity * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
