'use client'

import { useState, useCallback } from 'react'
import type { GraphNode } from '@/types/constellation'

export function useGraphInteractions(
  onNodeSelect?: (node: GraphNode | null) => void
) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node.id)
    onNodeSelect?.(node)
  }, [onNodeSelect])

  const deselect = useCallback(() => {
    setSelectedNode(null)
    onNodeSelect?.(null)
  }, [onNodeSelect])

  return {
    selectedNode,
    handleNodeClick,
    deselect,
  }
}
