'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { ConstellationGraph } from '@/components/constellation/ConstellationGraph'
import { GraphControls } from '@/components/constellation/GraphControls'
import { GraphSkeleton } from '@/components/constellation/GraphSkeleton'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import type { GraphData, GraphNode, ConstellationResponse } from '@/types/constellation'

// 16-color palette for tag clusters (computed here, passed to graph as node.color)
const TAG_COLORS = [
  '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#F43F5E', '#06B6D4',
  '#EAB308', '#22C55E', '#F97316', '#3B82F6', '#14B8A6', '#84CC16',
  '#A855F7', '#64748B', '#EF4444', '#EC4899',
]

function getTagColor(tag: string): string {
  if (!tag) return '#9CA3AF'
  return TAG_COLORS[tag.charCodeAt(0) % 16]
}

function transformToGraphData(response: ConstellationResponse): GraphData {
  const nodes: GraphNode[] = response.nodes.map((node) => ({
    id: node.id,
    label: node.link_title || node.text_content?.slice(0, 30) || '未命名记忆',
    group: node.tags?.[0] || 'default',
    val: node.is_starred ? 8 : 5,
    isStarred: node.is_starred,
    contentType: node.content_type as 'text' | 'link' | 'file',
    color: getTagColor(node.tags?.[0] || ''),
  }))

  const links = response.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    value: edge.similarity,
  }))

  return { nodes, links }
}

export function ConstellationPageClient() {
  // Keep original data separate from filtered view
  const [allGraphData, setAllGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [filteredNodes, setFilteredNodes] = useState<GraphNode[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [filterQuery, setFilterQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const fgRef = useRef<any>(null)

  const fetchConstellation = useCallback(async (currentOffset: number = 0) => {
    try {
      setLoading(true)
      const response = await api.getConstellation(currentOffset)
      if (response.success && response.data) {
        const newData = transformToGraphData(response.data)
        if (currentOffset === 0) {
          setAllGraphData(newData)
        } else {
          // Merge: add new nodes, append new links
          setAllGraphData((prev) => {
            const existingIds = new Set(prev.nodes.map((n) => n.id))
            const uniqueNew = newData.nodes.filter((n) => !existingIds.has(n.id))
            return {
              nodes: [...prev.nodes, ...uniqueNew],
              links: [...prev.links, ...newData.links],
            }
          })
        }
        setHasMore(response.data.has_more)
        setTotal(response.data.total)
        setError(null)
      } else {
        setError('星图数据加载失败')
      }
    } catch (err) {
      setError('星图数据加载失败，请检查网络后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConstellation(0)
  }, [fetchConstellation])

  const handleZoomIn = useCallback(() => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom()
      fgRef.current.zoom(currentZoom * 1.3, 300)
    }
  }, [])

  const handleZoomOut = useCallback(() => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom()
      fgRef.current.zoom(currentZoom / 1.3, 300)
    }
  }, [])

  const handleReset = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(300)
    }
  }, [])

  const handleNodeClick = useCallback((node: GraphNode) => {
    console.log('Node clicked:', node.id)
  }, [])

  // Filter: apply to derived view only, NEVER mutate original allGraphData
  const handleFilter = useCallback((query: string) => {
    setFilterQuery(query)
    if (!query) {
      setFilteredNodes(null)
      return
    }
    const lower = query.toLowerCase()
    setFilteredNodes(
      allGraphData.nodes.filter(
        (n) =>
          n.label.toLowerCase().includes(lower) ||
          n.group.toLowerCase().includes(lower)
      )
    )
  }, [allGraphData])

  // "探索更远" — load next batch with offset pagination
  const handleLoadMore = useCallback(() => {
    const newOffset = offset + 100
    setOffset(newOffset)
    fetchConstellation(newOffset)
  }, [offset, fetchConstellation])

  // Derived graph data: use filtered subset if filter is active, else all data
  const displayData: GraphData = useMemo(() => {
    if (filteredNodes !== null) {
      const filteredIds = new Set(filteredNodes.map((n) => n.id))
      return {
        nodes: filteredNodes,
        links: allGraphData.links.filter((link) => {
          const s = typeof link.source === 'object' ? (link.source as any).id : link.source
          const t = typeof link.target === 'object' ? (link.target as any).id : link.target
          return filteredIds.has(s) && filteredIds.has(t)
        }),
      }
    }
    return allGraphData
  }, [allGraphData, filteredNodes])

  if (!loading && allGraphData.nodes.length === 0 && !error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">星图还是一片空白</h2>
          <p className="text-muted-foreground mb-6">
            保存记忆后，它们之间的关联会自动在这里显现。试着保存第一条记忆吧。
          </p>
          <Button onClick={() => (window.location.href = '/capture')}>
            保存第一条记忆
          </Button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => fetchConstellation(0)}>重试</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      {loading && allGraphData.nodes.length === 0 ? (
        <GraphSkeleton />
      ) : (
        <>
          <ConstellationGraph
            ref={fgRef}
            data={displayData}
            onNodeClick={handleNodeClick}
          />
          <GraphControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleReset}
            onFilter={handleFilter}
            filterValue={filterQuery}
          />
          {hasMore && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
              <Button
                variant="default"
                className="rounded-full shadow-lg"
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? '加载中...' : '探索更远'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
