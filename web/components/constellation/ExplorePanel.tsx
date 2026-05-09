'use client'

import { useState, useEffect, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sparkles } from 'lucide-react'
import { BreadcrumbTrail } from './BreadcrumbTrail'
import { RelatedMemoryCard } from './RelatedMemoryCard'
import { api } from '@/lib/api'
import type { ExploreResponse, ExploreState } from '@/types/constellation'

interface ExplorePanelProps {
  memoryId: string
  onDrillDown?: (memoryId: string, label: string) => void
  breadcrumb?: ExploreState[]
  onNavigateBreadcrumb?: (index: number) => void
  onClearBreadcrumb?: () => void
}

export function ExplorePanel({
  memoryId,
  onDrillDown,
  breadcrumb = [],
  onNavigateBreadcrumb,
  onClearBreadcrumb,
}: ExplorePanelProps) {
  const [data, setData] = useState<ExploreResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchExplore = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.exploreMemory(memoryId)
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
  }, [memoryId])

  useEffect(() => {
    fetchExplore()
  }, [fetchExplore])

  const handleRelatedClick = (relatedId: string, label: string) => {
    onDrillDown?.(relatedId, label)
  }

  // Build breadcrumb items from prop
  const breadcrumbItems = breadcrumb.map((b) => ({
    id: b.memoryId,
    label: b.label,
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-2 animate-pulse" />
          <p className="text-sm text-muted-foreground">正在发现关联记忆...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <p className="text-sm text-destructive text-center">{error}</p>
      </div>
    )
  }

  if (!data || data.results.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <div className="text-center">
          <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-medium mb-1">这颗星独自闪耀</h3>
          <p className="text-xs text-muted-foreground">
            暂无足够关联记忆，保存更多内容后回来探索
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">上下文</h3>
      </div>

      {/* Breadcrumb */}
      <BreadcrumbTrail
        items={breadcrumbItems}
        onNavigate={onNavigateBreadcrumb}
        onClear={onClearBreadcrumb}
      />

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Center memory detail (if available) */}
          {data.breadcrumb.length > 0 && (
            <div className="border rounded-lg p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {data.breadcrumb[data.breadcrumb.length - 1]?.label || '当前记忆'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Related memories */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              关联记忆 ({data.results.length})
            </h4>
            <div className="space-y-3">
              {data.results.map((result) => (
                <RelatedMemoryCard
                  key={result.id}
                  memory={result}
                  onClick={() =>
                    handleRelatedClick(
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
      </ScrollArea>
    </div>
  )
}
