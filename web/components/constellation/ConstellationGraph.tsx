'use client'

import dynamic from 'next/dynamic'
import { useCallback, useRef, useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react'
import type { GraphData, GraphNode, GraphEdge } from '@/types/constellation'

const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d'),
  {
    ssr: false,
    loading: () => <GraphSkeleton />,
  }
)

import { GraphSkeleton } from './GraphSkeleton'

export interface ConstellationGraphRef {
  zoom: (k: number, ms?: number) => void
  zoomToFit: (ms?: number) => void
  centerAt: (x: number, y: number, ms?: number) => void
}

// Content type border colors (light/dark)
const BORDER_COLORS = {
  text: { light: '#9CA3AF', dark: '#6B7280' },
  link: { light: '#3B82F6', dark: '#60A5FA' },
  file: { light: '#10B981', dark: '#34D399' },
}

function getNodeLabel(node: GraphNode): string {
  const text = node.label || '未命名'
  if (text.length <= 20) return text
  return text.slice(0, 20) + '...'
}

interface ConstellationGraphProps {
  data: GraphData
  onNodeClick?: (node: GraphNode) => void
  maxNodes?: number
}

export const ConstellationGraph = forwardRef<ConstellationGraphRef, ConstellationGraphProps>(function ConstellationGraph({
  data,
  onNodeClick,
  maxNodes,
}, ref) {
  const fgRef = useRef<any>(null)
  const lastClickRef = useRef<{ id: string; time: number } | null>(null)

  useImperativeHandle(ref, () => ({
    zoom: (k: number, ms?: number) => fgRef.current?.zoom(k, ms),
    zoomToFit: (ms?: number) => fgRef.current?.zoomToFit(ms),
    centerAt: (x: number, y: number, ms?: number) => fgRef.current?.centerAt(x, y, ms),
  }))
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set())
  const [highlightLinks, setHighlightLinks] = useState<Set<number>>(new Set())
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark')
    }
    return false
  })

  // Listen for dark mode changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Limit nodes if specified (mobile degradation)
  const displayData = useMemo(() => {
    if (!maxNodes || data.nodes.length <= maxNodes) return data
    return {
      nodes: data.nodes.slice(0, maxNodes),
      links: data.links.filter(
        link => {
          const s = typeof link.source === 'object' ? (link.source as any).id : link.source
          const t = typeof link.target === 'object' ? (link.target as any).id : link.target
          const nodeIds = new Set(data.nodes.slice(0, maxNodes).map(n => n.id))
          return nodeIds.has(s) && nodeIds.has(t)
        }
      ),
    }
  }, [data, maxNodes])

  // Custom node rendering: reads node.color directly (computed by useConstellationData)
  // NO color recomputation here — centralized in useConstellationData per checker fix
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const size = (node.val || 5) as number
    const x = node.x || 0
    const y = node.y || 0
    const contentType = node.contentType as string
    const isStarred = node.isStarred as boolean
    const color = node.color as string
    const nodeId = node.id as string

    // Dim unconnected nodes when a node is selected or hovered
    const shouldDim = (highlightNodes.size > 0 || selectedNode) &&
      !highlightNodes.has(nodeId) &&
      nodeId !== selectedNode
    ctx.globalAlpha = shouldDim ? 0.3 : 1

    // Starred memory: gold glow
    if (isStarred) {
      ctx.beginPath()
      ctx.arc(x, y, size + 6, 0, 2 * Math.PI)
      ctx.fillStyle = isDark ? 'rgba(250, 204, 21, 0.25)' : 'rgba(250, 204, 21, 0.3)'
      ctx.fill()
    }

    // Main shape based on content type
    ctx.fillStyle = color
    ctx.strokeStyle = BORDER_COLORS[contentType as keyof typeof BORDER_COLORS]?.[isDark ? 'dark' : 'light'] || BORDER_COLORS.text.light
    ctx.lineWidth = 1.5

    if (contentType === 'link') {
      // Diamond: rotate 45deg
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(Math.PI / 4)
      ctx.fillRect(-size, -size, size * 2, size * 2)
      ctx.strokeRect(-size, -size, size * 2, size * 2)
      ctx.restore()
    } else if (contentType === 'file') {
      // Square
      ctx.fillRect(x - size, y - size, size * 2, size * 2)
      ctx.strokeRect(x - size, y - size, size * 2, size * 2)
    } else {
      // Circle (default for text)
      ctx.beginPath()
      ctx.arc(x, y, size, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()
    }

    // Node label (only when zoomed in enough)
    if (globalScale > 1.2) {
      const label = getNodeLabel(node as GraphNode)
      ctx.font = `${Math.max(8, 12 / globalScale)}px sans-serif`
      ctx.fillStyle = isDark ? '#E5E7EB' : '#374151'
      ctx.textAlign = 'center'
      ctx.fillText(label, x, y + size + 10)
    }

    ctx.globalAlpha = 1
  }, [isDark, highlightNodes, selectedNode])

  // Hover: highlight connected nodes and edges
  const handleNodeHover = useCallback((node: any | null) => {
    if (!node) {
      setHighlightNodes(new Set())
      setHighlightLinks(new Set())
      return
    }

    const connectedNodes = new Set<string>([node.id as string])
    const connectedLinks = new Set<number>()

    displayData.links.forEach((link, i) => {
      const source = typeof link.source === 'object' ? (link.source as any).id : link.source
      const target = typeof link.target === 'object' ? (link.target as any).id : link.target
      if (source === node.id || target === node.id) {
        connectedLinks.add(i)
        connectedNodes.add(source as string)
        connectedNodes.add(target as string)
      }
    })

    setHighlightNodes(connectedNodes)
    setHighlightLinks(connectedLinks)
  }, [displayData.links])

  // Click / double-click: select node; double-click zooms to node
  const handleNodeClick = useCallback((node: any) => {
    const now = Date.now()
    const last = lastClickRef.current
    if (last && last.id === node.id && now - last.time < 300) {
      // Double click: zoom to node
      if (fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 300)
        fgRef.current.zoom(2.0, 300)
      }
      lastClickRef.current = null
      return
    }
    lastClickRef.current = { id: node.id, time: now }
    setSelectedNode(node.id as string)
    onNodeClick?.(node as GraphNode)
  }, [onNodeClick])

  // Link styling by similarity (opacity baked into rgba when dimmed)
  const linkColor = useCallback((link: any) => {
    const idx = link.index as number
    const sim = link.value as number
    const isHighlighted = highlightLinks.has(idx)
    const isDimmed = selectedNode && !isHighlighted

    if (isDimmed) {
      return isDark ? 'rgba(107, 114, 128, 0.1)' : 'rgba(156, 163, 175, 0.1)'
    }
    if (isHighlighted || sim >= 0.90) return isDark ? '#D1D5DB' : '#374151'
    if (sim >= 0.80) return isDark ? '#9CA3AF' : '#6B7280'
    return isDark ? 'rgba(107, 114, 128, 0.4)' : 'rgba(156, 163, 175, 0.4)'
  }, [isDark, highlightLinks, selectedNode])

  const linkWidth = useCallback((link: any) => {
    const idx = link.index as number
    if (highlightLinks.has(idx)) return 2.5
    const sim = link.value as number
    if (sim >= 0.90) return 2
    if (sim >= 0.80) return 1.5
    return 1
  }, [highlightLinks])

  return (
    <div className="relative h-full w-full">
      <ForceGraph2D
        ref={fgRef}
        graphData={displayData}
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => 'replace'}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          const size = (node.val || 5) + 2
          const x = node.x || 0
          const y = node.y || 0
          const contentType = node.contentType as string
          ctx.fillStyle = color
          // Match actual node shapes for accurate pointer detection
          if (contentType === 'link') {
            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(Math.PI / 4)
            ctx.fillRect(-size, -size, size * 2, size * 2)
            ctx.restore()
          } else if (contentType === 'file') {
            ctx.fillRect(x - size, y - size, size * 2, size * 2)
          } else {
            ctx.beginPath()
            ctx.arc(x, y, size, 0, 2 * Math.PI)
            ctx.fill()
          }
        }}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
        linkColor={linkColor}
        linkWidth={linkWidth}
        warmupTicks={50}
        cooldownTicks={30}
        cooldownTime={8000}
        d3VelocityDecay={0.4}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        enablePointerInteraction={true}
        backgroundColor="transparent"
      />
    </div>
  )
})

ConstellationGraph.displayName = 'ConstellationGraph'
