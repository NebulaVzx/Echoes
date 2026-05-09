'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { GraphData, GraphNode, GraphEdge, ConstellationResponse } from '@/types/constellation'

// NOTE: Color computation is centralized in the page-client (getTagColor).
// This hook receives pre-colored nodes from the API response.
// It does NOT recompute colors — node.color is already set.
function transformNodes(responseNodes: ConstellationResponse['nodes']): GraphNode[] {
  return responseNodes.map((node) => ({
    id: node.id,
    label: node.link_title || node.text_content?.slice(0, 30) || '未命名记忆',
    group: node.tags?.[0] || 'default',
    val: node.is_starred ? 8 : 5,
    isStarred: node.is_starred,
    contentType: node.content_type as 'text' | 'link' | 'file',
    // color is pre-computed by the caller (page-client), NOT here
    color: '', // placeholder — caller must set after transform
  }))
}

function transformEdges(responseEdges: ConstellationResponse['edges']): GraphEdge[] {
  return responseEdges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    value: edge.similarity,
  }))
}

export function useConstellationData() {
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphEdge[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)

  const fetchConstellation = useCallback(async (currentOffset: number = 0) => {
    try {
      setLoading(true)
      const response = await api.getConstellation(currentOffset)
      if (response.success && response.data) {
        const newNodes = transformNodes(response.data.nodes)
        const newLinks = transformEdges(response.data.edges)

        if (currentOffset === 0) {
          setNodes(newNodes)
          setLinks(newLinks)
        } else {
          // Merge: add new nodes, append new links
          setNodes((prev) => {
            const existingIds = new Set(prev.map((n) => n.id))
            const uniqueNew = newNodes.filter((n) => !existingIds.has(n.id))
            return [...prev, ...uniqueNew]
          })
          setLinks((prev) => [...prev, ...newLinks])
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

  const loadMore = useCallback(() => {
    const newOffset = offset + 100
    setOffset(newOffset)
    fetchConstellation(newOffset)
  }, [offset, fetchConstellation])

  const refresh = useCallback(() => {
    setOffset(0)
    fetchConstellation(0)
  }, [fetchConstellation])

  useEffect(() => {
    fetchConstellation(0)
  }, [fetchConstellation])

  const graphData: GraphData = { nodes, links }

  return {
    graphData,
    hasMore,
    total,
    loading,
    error,
    loadMore,
    refresh,
    offset,
    setOffset,
  }
}
