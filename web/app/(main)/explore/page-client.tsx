'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { BreadcrumbTrail } from '@/components/constellation/BreadcrumbTrail'
import { RelatedMemoryCard } from '@/components/constellation/RelatedMemoryCard'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import type { ExploreResponse, ExploreState } from '@/types/constellation'

export function ExplorePageClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialId = searchParams.get('id')

  const [path, setPath] = useState<ExploreState[]>([])
  const [currentId, setCurrentId] = useState<string | null>(initialId)
  const [data, setData] = useState<ExploreResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchExplore = useCallback(async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.exploreMemory(id)
      if (response.success && response.data) {
        setData(response.data)
      } else {
        setError('加载失败')
      }
    } catch (err) {
      setError('关联记忆加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (currentId) {
      fetchExplore(currentId)
    }
  }, [currentId, fetchExplore])

  const handleDrillDown = useCallback((memoryId: string, label: string) => {
    // Record current node in path before navigating to new node
    if (currentId) {
      const currentLabel = data?.breadcrumb[data.breadcrumb.length - 1]?.label || '记忆'
      setPath((prev) => [...prev, { memoryId: currentId, label: currentLabel }])
    }
    setCurrentId(memoryId)
    // Update URL for deep-linking
    router.push(`/explore?id=${memoryId}`)
  }, [currentId, router, data])

  const handleNavigateBreadcrumb = useCallback((index: number) => {
    // Breadcrumb items = path (history) + data.breadcrumb (current)
    const pathItems = path.map((p) => ({ id: p.memoryId, label: p.label }))
    if (index < pathItems.length) {
      // Clicked a historical node: truncate path and navigate back
      const target = pathItems[index]
      setPath((prev) => prev.slice(0, index))
      setCurrentId(target.id)
      router.push(`/explore?id=${target.id}`)
    }
    // Clicking current node (index >= pathItems.length) is a no-op
  }, [path, router])

  const handleClear = useCallback(() => {
    setPath([])
    const firstId = searchParams.get('id')
    if (firstId) {
      setCurrentId(firstId)
      router.push(`/explore?id=${firstId}`)
    }
  }, [searchParams, router])

  // No initial ID state
  if (!initialId) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <div className="text-center">
          <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">选择一颗星开始探索</h2>
          <p className="text-muted-foreground mb-6">
            在时间轴或星图中点击任意记忆，即可开启探索之旅
          </p>
          <Button onClick={() => router.push('/')}>去时间轴</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Mobile header with back button */}
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold">探索模式</h1>
      </div>

      {/* Breadcrumb */}
      <BreadcrumbTrail
        items={[
          ...path.map((p) => ({ id: p.memoryId, label: p.label })),
          ...(data?.breadcrumb.map((b) => ({ id: b.id, label: b.label })) || []),
        ]}
        onNavigate={handleNavigateBreadcrumb}
        onClear={handleClear}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading && !data ? (
          <div className="flex items-center justify-center h-full">
            <Sparkles className="h-8 w-8 text-muted-foreground animate-pulse" />
          </div>
        ) : error ? (
          <p className="text-destructive text-center">{error}</p>
        ) : data && data.results.length > 0 ? (
          <div className="space-y-4">
            {/* Center memory card */}
            {data.breadcrumb.length > 0 && (
              <div className="border rounded-lg p-4 bg-card">
                <h2 className="text-lg font-semibold mb-1">
                  {data.breadcrumb[data.breadcrumb.length - 1]?.label}
                </h2>
                <p className="text-sm text-muted-foreground">当前中心记忆</p>
              </div>
            )}

            {/* Related memories */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                关联记忆 ({data.results.length})
              </h3>
              <div className="space-y-3">
                {data.results.map((result) => (
                  <RelatedMemoryCard
                    key={result.id}
                    memory={result}
                    onClick={() =>
                      handleDrillDown(
                        result.id,
                        result.link_title ||
                          result.text_content?.slice(0, 20) ||
                          result.file_name ||
                          '未命名'
                      )
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">这颗星独自闪耀</p>
          </div>
        )}
      </div>
    </div>
  )
}
