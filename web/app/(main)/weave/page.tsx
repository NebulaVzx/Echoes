'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, Memory } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, PenLine, ArrowRight } from 'lucide-react'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function WeavePage() {
  const [weaves, setWeaves] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWeaves = async () => {
      try {
        setLoading(true)
        const response = await api.listMemories({ limit: 100 })
        if (response.success && response.data) {
          // Filter weave type memories
          const weaveMemories = response.data.memories.filter(m => m.content_type === 'weave')
          setWeaves(weaveMemories)
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchWeaves()
  }, [])

  return (
    <div className="mx-auto max-w-content-timeline px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <PenLine className="w-5 h-5" />
            记忆编织
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            在时间轴中选择多条记忆，用 AI 编织成文章、故事或摘要
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : weaves.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">还没有编织内容</p>
          <p className="text-sm text-gray-400">
            去时间轴中选择记忆，点击「编织」按钮创建
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 mt-4 text-sm text-primary hover:underline"
          >
            去时间轴
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {weaves.map((weave) => (
            <Link
              key={weave.id}
              href={`/weave/${weave.id}`}
              className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-2">
                    {weave.text_content?.slice(0, 100) || '无标题编织'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {formatDate(weave.created_at)} · {weave.tags?.length || 0} 标签
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
