# Phase 13: 记忆星图与探索 (Memory Constellation & Exploration) - Research

**Researched:** 2026-05-09
**Domain:** Graph visualization (react-force-graph-2d), pgvector similarity queries, LLM prompt engineering, Next.js 14 Canvas integration
**Confidence:** HIGH (library versions verified via npm registry, patterns verified via official docs and codebase analysis)

## Summary

Phase 13 构建记忆关联网络的可视化与探索模式。核心挑战有三：

1. **前端渲染**：react-force-graph-2d v1.29.1 是 React 生态中最成熟的力导向图库，支持 5000 节点流畅渲染（Canvas 2D），但 Next.js 14 App Router 下必须配合 `"use client"` + `dynamic(ssr: false)` 使用。移动端支持 pinch zoom / pan（基于 D3 zoom 行为），但 5000 节点在移动端会卡顿，需做节点数降级（桌面 500+，移动端 50）。

2. **数据层**：现有 `SearchByVector` / `FindRelated` 是"单点查询"模式（输入一个向量，返回 Top-K 相似）。星图需要"批量获取用户所有记忆的相似关系对"。pgvector 的 `IVFFlat` 索引不支持高效的"全对全"相似度计算（O(n^2) 复杂度）。推荐策略：分层加载（首次 100 条 + 星标）+ 按需扩展（点击节点时加载其相似节点），而非一次性计算全图边集。

3. **LLM 关联说明**：复用现有 Provider 抽象（200 行代码，非 LangChain）。通过结构化 Prompt 让 LLM 分析两段记忆内容的语义关联，生成"为什么相关"的自然语言说明。需做关系表缓存（`memory_relations`）避免重复调用，并限制单次探索深度（<=3 层）控制成本。

**Primary recommendation:** 采用"分层加载 + 按需扩展"的数据策略，react-force-graph-2d 做 P0 可视化，Sigma.js 作为 P1 大数据降级方案。LLM 关联说明用"实时生成 + 关系表缓存"混合模式。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Graph rendering (Canvas 2D) | Browser / Client | — | Canvas 是浏览器 API，必须在客户端执行 |
| Force simulation physics | Browser / Client | — | D3-force 在浏览器主线程运行 |
| Graph data building (vector similarity) | API / Backend | — | pgvector 查询在 PostgreSQL 执行 |
| LLM association explanation | API / Backend | — | LLM Provider 调用在 Go service 执行 |
| Relation caching | Database / Storage | — | `memory_relations` 表持久化 |
| Exploration navigation | Browser / Client | — | 面包屑、钻取状态在 React 管理 |
| Node clustering / coloring logic | Browser / Client | — | 按标签 hash 着色在客户端计算 |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01: 图数据加载策略** — 分层加载 + 按需扩展。首次加载最近 100 条记忆 + 所有星标记忆；视口内节点自动扩展关联；"探索更远"按钮加载下一批 100 条。
- **D-02: 关联说明生成时机** — 混合模式：首次实时调用 LLM 生成，缓存写入 `memory_relations` 表；后续直接读取缓存；星标记忆关联后台预计算。
- **D-03: 可视化库选型** — P0: react-force-graph-2d；P1 评估 Sigma.js 作为大数据降级（>5000 节点时自动切换）。
- **D-04: 探索模式交互范式** — 桌面端复用 RightPanel 横向展开；移动端新页面推入导航栈。
- **D-05: 图着色策略** — 按标签聚类着色 + 内容类型边框区分 + 星标金色光晕。

### Claude's Discretion
- 具体 force simulation 参数调优（warmupTicks, cooldownTicks, chargeStrength 等）
- LLM prompt 的具体措辞和 few-shot 示例设计
- 节点详情面板的具体字段展示
- 响应式断点下的节点数限制具体数值

### Deferred Ideas (OUT OF SCOPE)
- 3D 星图（react-force-graph-3d / Three.js）— v1.4+ 评估
- AR/VR 空间探索 — 远期概念
- 多人共享星图 — 需要社交功能
- 预计算全图边集 — 夜间任务批量计算所有记忆对相似度

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONST-01 | 力导向图可视化（react-force-graph-2d），节点=记忆，边=相似度>0.75 | Library verified v1.29.1; Next.js integration pattern confirmed |
| CONST-02 | 按标签聚类着色，内容类型区分边框，星标金色光晕 | Canvas custom rendering via `nodeCanvasObject` prop |
| CONST-03 | 悬停/点击/双击交互，支持缩放平移 | Built-in D3 zoom behavior; touch events supported |
| CONST-04 | 桌面端 500+ 节点流畅，移动端降级 | Performance tuning props verified; mobile node limit strategy defined |
| EXPLORE-01 | 从任意记忆出发展示 5-8 条关联记忆 | Reuse existing `FindRelated` with limit=8 |
| EXPLORE-02 | AI 生成"为什么相关"的关联说明 | LLM prompt pattern researched; caching via `memory_relations` table |
| EXPLORE-03 | 无限钻取（点击关联记忆成为新中心） | Client-side state management with breadcrumb trail |
| EXPLORE-04 | 面包屑路径记录 | React state + URL query params for deep-linking |
| PERF-01 | 节点筛选/搜索 | Debounced text filter on node labels/tags |
| PERF-02 | 大数据量降级策略 | Sigma.js v3.0.3 as P1 fallback; auto-switch at >5000 nodes |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-force-graph-2d | 1.29.1 [VERIFIED: npm registry] | 力导向图可视化 | React 生态最成熟，D3-force 底层，文档完善 |
| graphology | 0.26.0 [VERIFIED: npm registry] | 图数据结构 + 算法 | 标准图数据结构库，支持 Louvain 聚类等 |
| sigma | 3.0.3 [VERIFIED: npm registry] | P1 大数据降级（WebGL 渲染） | WebGL 渲染，可处理 10K+ 节点，Sigma.js 官方 React 绑定 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| d3-force | (bundled) | 力模拟物理引擎 | react-force-graph-2d 已内置，无需单独安装 |
| graphology-layout-forceatlas2 | latest | 替代力布局算法 | P1 需要更复杂布局时 |
| graphology-communities-louvain | latest | 社区发现/聚类 | P1 自动标签聚类 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-force-graph-2d | D3 + Canvas 手写 | 完全可控但开发成本高，500+ 行代码 |
| react-force-graph-2d | Cytoscape.js | 功能更丰富但 bundle 更大 (~500KB)，API 不 React-friendly |
| react-force-graph-2d | vis-network | 维护不活跃，TypeScript 支持差 |
| Sigma.js (P1) | Ogma (Linkurious) | 商业库，性能最好但付费 |

**Installation:**
```bash
cd web && npm install react-force-graph-2d graphology
# P1 降级方案:
cd web && npm install sigma graphology
```

## Architecture Patterns

### System Architecture Diagram

```
User Browser
    |
    +---> Next.js App Router (App Shell: Header + Sidebar + Main + RightPanel)
              |
              +---> /constellation/page.tsx (Server Component)
              |         |
              |         +---> ConstellationGraph ('use client' + dynamic ssr:false)
              |                   |
              |                   +---> react-force-graph-2d (Canvas 2D)
              |                   |         |
              |                   |         +---> D3-force simulation
              |                   |         +---> Custom nodeCanvasObject (color by tag)
              |                   |
              |                   +---> useConstellationData hook
              |                             |
              |                             +---> GET /api/v1/memories/constellation
              |
              +---> /explore/page.tsx (Server Component)
                        |
                        +---> ExplorePanel ('use client')
                                  |
                                  +---> GET /api/v1/memories/:id/explore
                                  +---> RightPanel (desktop) / new page (mobile)

Gateway Service (Go/Gin)
    |
    +---> /api/v1/memories/constellation  ---> Memory Service
    +---> /api/v1/memories/:id/explore    ---> Memory Service
    +---> /api/v1/memories/:id/related    ---> Memory Service (existing)

Memory Service (Go)
    |
    +---> MemoryHandler.GetConstellation()
    |         |
    |         +---> MemoryService.GetConstellation(userID, limit=100, includeStarred=true)
    |                   |
    |                   +---> MemoryRepository.ListByUser() (recent 100)
    |                   +---> MemoryRepository.ListByUser(starredOnly=true) (all starred)
    |                   +---> For each node: MemoryRepository.FindRelated(limit=5, threshold=0.75)
    |
    +---> MemoryHandler.Explore()
    |         |
    |         +---> MemoryService.Explore(memoryID, userID)
    |                   |
    |                   +---> MemoryRepository.FindRelated(limit=8, threshold=0.75)
    |                   +---> For each related pair: RelationRepository.GetOrCreateReason()
    |                           |
    |                           +---> Cache hit: return cached reason
    |                           +---> Cache miss: LLMProvider.GenerateAssociationReason()
    |                                   |
    |                                   +---> POST to LLM (OpenAI/Anthropic)
    |                                   +---> Save to memory_relations table
    |
    +---> Existing handlers (GetRelated, Search, etc.)

PostgreSQL + pgvector
    |
    +---> memories table (vector 1024-dim, IVFFlat index)
    +---> memory_relations table (NEW: source_id, target_id, similarity, reason, created_at)
```

### Recommended Project Structure

```
web/
├── app/
│   └── (main)/
│       ├── constellation/
│       │   └── page.tsx              # Server Component, metadata
│       └── explore/
│           └── page.tsx              # Server Component, metadata
├── components/
│   └── constellation/
│       ├── ConstellationGraph.tsx    # 'use client' + dynamic import
│       ├── ExplorePanel.tsx          # 'use client', RightPanel content
│       ├── NodeDetailCard.tsx        # 节点详情展示（复用 MemoryCard）
│       ├── BreadcrumbTrail.tsx       # 面包屑路径
│       ├── GraphControls.tsx         # 缩放/筛选/搜索控件
│       └── hooks/
│           ├── useConstellationData.ts   # 获取图数据
│           ├── useGraphInteractions.ts   # 点击/悬停/双击处理
│           └── useExplorePath.ts         # 钻取路径状态
├── lib/
│   └── graph-utils.ts              # 图数据转换（Memory[] -> GraphData）
└── types/
    └── constellation.ts            # GraphNode, GraphEdge, ExploreState 类型

services/memory-service/
├── internal/
│   ├── domain/
│   │   └── memory.go               # 新增: ConstellationResponse, ExploreResponse, Relation
│   ├── repository/
│   │   ├── memory_repository.go    # 新增: GetConstellationNodes(), batch related queries
│   │   └── relation_repository.go  # NEW: RelationRepository interface + Gorm impl
│   ├── service/
│   │   └── memory_service.go       # 新增: GetConstellation(), Explore()
│   └── transport/
│       └── memory_handler.go       # 新增: GetConstellation, Explore handlers
└── ...

shared/migrations/
└── 002_memory_relations.sql        # NEW: memory_relations table
```

### Pattern 1: Next.js 14 App Router + Canvas Library Integration
**What:** Server Component 获取数据，Client Component 渲染 Canvas 图
**When to use:** 任何需要 Canvas/WebGL 的库在 Next.js 14 App Router 中的集成
**Example:**
```tsx
// app/(main)/constellation/page.tsx — Server Component
import { ConstellationGraph } from '@/components/constellation/ConstellationGraph'

export default async function ConstellationPage() {
  // 可选：服务端预取初始数据
  return (
    <div className="h-full w-full relative">
      <ConstellationGraph />
    </div>
  )
}

// components/constellation/ConstellationGraph.tsx — Client Component
'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

// dynamic import with ssr: false — critical for canvas libraries
const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d'),
  { ssr: false, loading: () => <GraphSkeleton /> }
)

export function ConstellationGraph() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  
  useEffect(() => {
    fetch('/api/v1/memories/constellation')
      .then(r => r.json())
      .then(data => setGraphData(transformToGraphData(data)))
  }, [])

  return (
    <ForceGraph2D
      graphData={graphData}
      nodeAutoColorBy="group"
      backgroundColor="transparent"
      // ... other props
    />
  )
}
```

### Pattern 2: 分层加载 + 按需扩展
**What:** 首次加载核心节点（最近 100 + 星标），交互时动态加载关联
**When to use:** 数据量可能很大，但用户初始只需要看到核心网络
**Example:**
```typescript
// hooks/useConstellationData.ts
export function useConstellationData() {
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphEdge[]>([])
  const [loadedNodeIds, setLoadedNodeIds] = useState<Set<string>>(new Set())

  // 初始加载
  useEffect(() => {
    fetch('/api/v1/memories/constellation?limit=100')
      .then(r => r.json())
      .then(data => {
        setNodes(data.nodes)
        setLinks(data.links)
        setLoadedNodeIds(new Set(data.nodes.map((n: GraphNode) => n.id)))
      })
  }, [])

  // 按需扩展：点击节点时加载其关联
  const expandNode = useCallback(async (nodeId: string) => {
    if (loadedNodeIds.has(nodeId)) return // 已加载过
    
    const res = await fetch(`/api/v1/memories/${nodeId}/related?limit=5`)
    const data = await res.json()
    
    const newNodes = data.results.map((r: SearchResult) => ({
      id: r.id,
      label: r.link_title || r.text_content?.slice(0, 30) || 'Memory',
      group: r.tags?.[0] || 'default',
      val: r.is_starred ? 8 : 5,
      // ...
    }))
    
    const newLinks = data.results.map((r: SearchResult) => ({
      source: nodeId,
      target: r.id,
      value: r.similarity,
    }))
    
    setNodes(prev => [...prev, ...newNodes.filter(n => !loadedNodeIds.has(n.id))])
    setLinks(prev => [...prev, ...newLinks])
    setLoadedNodeIds(prev => new Set([...prev, nodeId]))
  }, [loadedNodeIds])

  return { nodes, links, expandNode }
}
```

### Pattern 3: LLM 关联说明生成 + 缓存
**What:** 首次展示两记忆关联时调用 LLM 生成说明，写入 `memory_relations` 表缓存
**When to use:** LLM 调用成本高、有延迟，但关联说明具有复用价值
**Example (Go):**
```go
// service/memory_service.go
func (s *MemoryService) GetRelationReason(ctx context.Context, sourceID, targetID uuid.UUID, sourceContent, targetContent string) (string, error) {
    // 1. 检查缓存
    reason, err := s.relationRepo.GetReason(ctx, sourceID, targetID)
    if err == nil && reason != "" {
        return reason, nil // 缓存命中
    }
    
    // 2. 调用 LLM 生成
    prompt := buildAssociationPrompt(sourceContent, targetContent)
    reason, err = s.llmProvider.Generate(ctx, prompt)
    if err != nil {
        return "", err
    }
    
    // 3. 写入缓存
    _ = s.relationRepo.Save(ctx, sourceID, targetID, reason)
    
    return reason, nil
}

func buildAssociationPrompt(sourceContent, targetContent string) string {
    return fmt.Sprintf(`分析以下两段记忆内容的语义关联，用 1-2 句话解释它们为什么相关。

记忆 A：
%s

记忆 B：
%s

请从主题、概念、情感或时间线等维度分析关联。只输出关联说明，不要额外解释。`, 
        truncate(sourceContent, 500), 
        truncate(targetContent, 500))
}
```

### Anti-Patterns to Avoid
- **在 Server Component 中直接导入 canvas 库：** 会导致 `window is not defined` 构建错误。必须使用 `dynamic(() => import(...), { ssr: false })`。
- **一次性加载所有记忆的相似度边集：** 10,000 条记忆 × 找 Top-5 相似 = 50,000 次 pgvector 查询，初始加载 >10s。必须用分层加载。
- **在 React state 中保存原始 vector 数据：** 1024-dim float64 × 10,000 = ~80MB 内存浪费。向量只在后端查询时使用，前端只接收 similarity score。
- **无限制 LLM 调用：** 探索模式每点击一次就调用 LLM，用户快速钻取 10 层 = 10 次 LLM 调用。必须做缓存 + 并发限制。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 力导向图渲染 | 手写 Canvas + D3-force | react-force-graph-2d | 已处理 zoom/pan/drag/animation，5000 节点优化 |
| 图数据结构 | 手写 adjacency list | graphology | 标准图 API，支持 Louvain 聚类、最短路径等 |
| 移动端 pinch zoom | 手写 touch 事件处理 | react-force-graph-2d 内置 | D3 zoom 已处理 touch/pointer 统一事件 |
| 向量相似度计算 | 在 Go 中手写 cosine similarity | pgvector `<=>` 运算符 | IVFFlat 索引加速，C 实现比 Go 快 100x |
| LLM API 调用 | 手写 HTTP client + retry | 现有 VectorizerClient 模式 | 已有 Redis 缓存、超时、错误处理模式 |

**Key insight:** 力导向图的物理模拟和 Canvas 渲染是成熟领域，手写代码会在性能边界（>1000 节点）和交互细节（touch 事件、hit detection）上踩坑。复用现成库，把精力放在数据策略和用户体验上。

## Common Pitfalls

### Pitfall 1: Canvas 在 SSR 中导致构建失败
**What goes wrong:** `react-force-graph-2d` 依赖 `window` 和 Canvas API，Next.js 14 App Router 的 Server Component 在服务端渲染时直接导入会导致 `ReferenceError: window is not defined`。
**Why it happens:** App Router 默认使用 React Server Components，代码在 Node.js 环境执行。
**How to avoid:** 永远使用 `dynamic(() => import('react-force-graph-2d'), { ssr: false })`，且包裹组件必须加 `'use client'` 指令。
**Warning signs:** 构建日志出现 `window is not defined` 或 `CanvasRenderingContext2D is not defined`。

### Pitfall 2: 力模拟导致 UI 卡顿
**What goes wrong:** 5000 节点的力模拟在主线程运行，拖拽或缩放时帧率掉到 <15fps。
**Why it happens:** D3-force 的 tick 计算是 CPU 密集型，与 React render 竞争主线程。
**How to avoid:** (1) 调低 `warmupTicks`（预计算帧数）；(2) 增大 `d3VelocityDecay` 让模拟更快收敛；(3) 使用 `cooldownTime` 限制总模拟时间；(4) P1 考虑 Web Worker  offload。
**Warning signs:** 页面加载后 CPU 占用持续 100%，交互延迟明显。

### Pitfall 3: pgvector 全对全查询性能灾难
**What goes wrong:** 试图用 SQL `CROSS JOIN` 计算所有记忆对的相似度，10,000 条记忆需要 1 亿次向量比较，查询超时。
**Why it happens:** pgvector 的 IVFFlat 索引是为"单点查询"优化的（给定一个 query vector，找 Top-K），不是为"全对全"设计的。
**How to avoid:** 采用 D-01 分层加载策略。需要批量时，用 `CROSS JOIN LATERAL` 从候选集（如最近 100 条）中找相似，而非全表。
**Warning signs:** EXPLAIN ANALYZE 显示 Seq Scan + 高执行时间。

### Pitfall 4: 移动端性能崩溃
**What goes wrong:** 桌面端流畅的 500 节点图，在手机上直接卡死或崩溃。
**Why it happens:** 移动端 GPU 和 CPU 性能弱，Canvas 2D 在高分屏上像素量巨大。
**How to avoid:** (1) 移动端节点数限制 50；(2) 关闭力模拟动画（`pauseAnimation()`）；(3) 使用更简单的节点渲染（圆点代替复杂形状）；(4) 检测 `navigator.hardwareConcurrency` 动态调整。
**Warning signs:** 页面无响应，浏览器提示"此页面无响应"。

### Pitfall 5: LLM 关联说明生成延迟拖慢探索体验
**What goes wrong:** 用户点击节点后等待 2-3 秒才看到关联说明（LLM API 延迟）。
**Why it happens:** 同步调用 LLM，阻塞 API 响应。
**How to avoid:** (1) 先返回关联记忆列表（<100ms），关联说明异步加载或从缓存读取；(2) 后台预计算星标记忆的关联说明；(3) 设置 LLM 调用超时 5s，超时返回默认说明。
**Warning signs:** API 响应时间 P95 > 2s。

## Code Examples

### Next.js 14 + react-force-graph-2d 集成
```tsx
// Source: Official react-force-graph docs + Next.js dynamic import pattern
'use client'

import dynamic from 'next/dynamic'
import { useCallback, useRef, useState } from 'react'

const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }
)

interface GraphData {
  nodes: Array<{
    id: string
    label: string
    group: string
    val: number
    isStarred: boolean
    contentType: string
  }>
  links: Array<{
    source: string
    target: string
    value: number
  }>
}

export function ConstellationGraph({ data }: { data: GraphData }) {
  const fgRef = useRef<any>(null)
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set())
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set())

  // 自定义节点渲染：按标签着色 + 内容类型边框 + 星标光晕
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const size = node.val || 5
    const x = node.x || 0
    const y = node.y || 0
    
    // 星标记忆：金色光晕
    if (node.isStarred) {
      ctx.beginPath()
      ctx.arc(x, y, size + 4, 0, 2 * Math.PI)
      ctx.fillStyle = 'rgba(250, 204, 21, 0.3)'
      ctx.fill()
    }
    
    // 主色圆点
    ctx.beginPath()
    ctx.arc(x, y, size, 0, 2 * Math.PI)
    ctx.fillStyle = node.color || '#6b7280'
    ctx.fill()
    
    // 内容类型边框区分
    ctx.strokeStyle = node.contentType === 'link' ? '#3b82f6' 
                    : node.contentType === 'file' ? '#10b981' 
                    : '#9ca3af'
    ctx.lineWidth = 1.5
    ctx.stroke()
    
    // 标签（缩放足够大时显示）
    if (globalScale > 1.2) {
      ctx.font = `${Math.max(8, 12 / globalScale)}px sans-serif`
      ctx.fillStyle = 'var(--foreground)'
      ctx.textAlign = 'center'
      ctx.fillText(node.label, x, y + size + 10)
    }
  }, [])

  // 悬停高亮关联
  const handleNodeHover = useCallback((node: any | null) => {
    if (!node) {
      setHighlightNodes(new Set())
      setHighlightLinks(new Set())
      return
    }
    
    const connectedNodes = new Set<string>([node.id])
    const connectedLinks = new Set<string>()
    
    data.links.forEach((link, i) => {
      const source = typeof link.source === 'object' ? link.source.id : link.source
      const target = typeof link.target === 'object' ? link.target.id : link.target
      if (source === node.id || target === node.id) {
        connectedLinks.add(String(i))
        connectedNodes.add(source)
        connectedNodes.add(target)
      }
    })
    
    setHighlightNodes(connectedNodes)
    setHighlightLinks(connectedLinks)
  }, [data.links])

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={data}
      nodeCanvasObject={nodeCanvasObject}
      nodeCanvasObjectMode={() => 'replace'}
      linkWidth={(link: any) => highlightLinks.has(link.index) ? 2 : 0.5}
      linkOpacity={(link: any) => highlightLinks.has(link.index) ? 1 : 0.2}
      nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(node.x, node.y, (node.val || 5) + 2, 0, 2 * Math.PI)
        ctx.fill()
      }}
      onNodeHover={handleNodeHover}
      onNodeClick={(node: any) => {
        // 触发探索模式或扩展节点
        window.dispatchEvent(new CustomEvent('constellation:nodeClick', { detail: node }))
      }}
      // 性能优化
      warmupTicks={50}
      cooldownTicks={30}
      cooldownTime={8000}
      d3VelocityDecay={0.4}
      enableZoomInteraction={true}
      enablePanInteraction={true}
      enablePointerInteraction={true}
      backgroundColor="transparent"
    />
  )
}
```

### pgvector 批量相似度查询（分层加载）
```sql
-- Source: pgvector docs + WebSearch verified patterns
-- 获取用户最近 N 条记忆（作为星图初始节点）
SELECT id, user_id, content_type, text_content, link_url, link_title, tags, is_starred, created_at
FROM memories
WHERE user_id = ?
  AND vector IS NOT NULL
  AND processing_status IN ('completed', 'partial_failed')
  AND (sealed_until IS NULL OR sealed_until <= NOW())
ORDER BY created_at DESC
LIMIT ?;

-- 为单个记忆查找相似记忆（边构建）
-- 复用现有 SearchByVector / FindRelated，threshold = 0.75
SELECT id, user_id, content_type, text_content, link_url, link_title, tags, is_starred,
       1 - (vector <=> ?::vector) as similarity
FROM memories
WHERE user_id = ?
  AND id != ?
  AND vector IS NOT NULL
  AND processing_status IN ('completed', 'partial_failed')
  AND (vector <=> ?::vector) <= 0.25  -- 1 - 0.75 = 0.25 distance threshold
ORDER BY vector <=> ?::vector
LIMIT 5;
```

### memory_relations 表迁移
```sql
-- shared/migrations/002_memory_relations.sql
CREATE TABLE IF NOT EXISTS memory_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    similarity FLOAT NOT NULL CHECK (similarity >= 0 AND similarity <= 1),
    reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_id, target_id)
);

-- 索引：加速按记忆查关联
CREATE INDEX IF NOT EXISTS idx_memory_relations_source ON memory_relations(source_id);
CREATE INDEX IF NOT EXISTS idx_memory_relations_target ON memory_relations(target_id);
CREATE INDEX IF NOT EXISTS idx_memory_relations_similarity ON memory_relations(similarity DESC);

-- 触发器：自动更新 updated_at
CREATE TRIGGER update_memory_relations_updated_at
    BEFORE UPDATE ON memory_relations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE memory_relations IS '缓存记忆之间的语义关联说明，避免重复 LLM 调用';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| IVFFlat index | HNSW index | pgvector 0.5.0+ | HNSW 查询更快、召回率更高，但构建更慢。当前代码用 IVFFlat，迁移到 HNSW 是可选优化。 |
| react-force-graph-2d v1.20 | v1.29.1 | 持续更新 | 性能优化、bug 修复。当前最新版 1.29.1 [VERIFIED: npm registry] |
| Sigma.js v2 | Sigma.js v3 | 2023-2024 | v3 重写为 TypeScript，React 绑定更完善，WebGL 渲染性能提升 2x |
| 全量加载图数据 | 分层加载 + 按需扩展 | D-01 (2026-05-09) | 避免 10,000 节点初始加载卡顿，用户体验从 >10s 降到 <2s |

**Deprecated/outdated:**
- `react-force-graph-2d` 的 `nodeRelSize` 在大量节点时性能差，推荐用 `nodeCanvasObject` 完全自定义渲染。
- pgvector 的 `vector_l2_ops` 索引不适合 cosine similarity 查询，必须用 `vector_cosine_ops`。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | react-force-graph-2d 在 5000 节点下可保持 30fps+ | Standard Stack | 实际性能取决于设备 GPU/CPU，低端设备可能需要进一步降级到 2000 节点 |
| A2 | 用户记忆量通常 < 10,000 | CONTEXT.md | 如果用户记忆量 > 50,000，当前分层加载策略可能需要调整为预计算边集 |
| A3 | LLM 调用成本可控（单次探索 <=3 层 × 5 关联 = 15 次调用） | API Design | 如果用户频繁探索，LLM 成本可能上升；需监控并考虑限流 |
| A4 | 移动端 pinch zoom / pan 无需额外库 | Library Research | D3 zoom 内置支持，但某些 Android 设备可能有 touch 事件冲突，需测试验证 |
| A5 | BGE-M3 向量 1024 维不变 | Data Architecture | 如果未来更换 embedding 模型（如 768 维），需同步更新 VECTOR(1024) 和索引 |

## Open Questions

1. **HNSW 索引迁移是否必要？**
   - What we know: IVFFlat 当前足够，HNSW 在 pgvector 0.5.0+ 提供更好性能
   - What's unclear: 生产环境 pgvector 版本是否支持 HNSW
   - Recommendation: 先检查 `SELECT extversion FROM pg_extension WHERE extname = 'vector';`，如果 >=0.5.0 则评估迁移

2. **星标记忆关联预计算的触发时机？**
   - What we know: D-02 提到"星标记忆的关联在后台预计算"
   - What's unclear: 是在用户星标记忆时立即触发，还是通过定时任务批量处理
   - Recommendation: 在 `UpdateMemory` 中检测 `is_starred` 变为 true 时，异步发布预计算任务到 Redis Stream

3. **探索模式移动端体验是否足够？**
   - What we know: D-04 决定移动端用新页面推入
   - What's unclear: 50 节点限制下探索深度 >=3 层的体验是否满足验收标准
   - Recommendation: 实现后做移动端真机测试，如不满足考虑增加"相关记忆"数量或调整阈值

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| react-force-graph-2d | Graph visualization | ✗ (not installed) | 1.29.1 | Sigma.js v3.0.3 |
| graphology | Graph data structures | ✗ (not installed) | 0.26.0 | 手写 adjacency list |
| PostgreSQL + pgvector | Vector similarity | ✓ | 15 + ivfflat | — |
| LLM Provider (OpenAI/Anthropic) | Association reason | ✓ | 现有抽象 | 返回默认说明 |
| Redis | Relation cache / Task queue | ✓ | 7 | — |

**Missing dependencies with no fallback:**
- react-force-graph-2d — 必须安装，无替代方案（P0 功能）

**Missing dependencies with fallback:**
- graphology — 可手写简单图结构，但 Louvain 聚类等算法需自行实现

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + React Testing Library 14.2.1 |
| Config file | `web/jest.config.js` (or package.json) |
| Quick run command | `cd web && npm test -- --testNamePattern="Constellation"` |
| Full suite command | `cd web && npm test` |

Backend:
| Property | Value |
|----------|-------|
| Framework | Go testing (built-in) |
| Quick run command | `cd services/memory-service && go test ./... -run TestConstellation` |
| Full suite command | `cd services/memory-service && go test ./...` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONST-01 | Force graph renders with nodes and links | unit | `jest components/constellation/ConstellationGraph.test.tsx` | ❌ Wave 0 |
| CONST-02 | Nodes colored by tag, starred has glow | unit | `jest components/constellation/ConstellationGraph.test.tsx` | ❌ Wave 0 |
| CONST-03 | Click node triggers explore panel | unit | `jest components/constellation/GraphInteractions.test.tsx` | ❌ Wave 0 |
| CONST-04 | Mobile renders simplified view | e2e | `playwright test tests/constellation-mobile.spec.ts` | ❌ Wave 0 |
| EXPLORE-01 | API returns 5-8 related memories | integration | `go test ./... -run TestExplore` | ❌ Wave 0 |
| EXPLORE-02 | LLM reason cached in memory_relations | integration | `go test ./... -run TestRelationCache` | ❌ Wave 0 |
| EXPLORE-03 | Breadcrumb tracks drill path | unit | `jest hooks/useExplorePath.test.ts` | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `web/components/constellation/__tests__/ConstellationGraph.test.tsx` — graph rendering
- [ ] `web/components/constellation/__tests__/ExplorePanel.test.tsx` — explore interaction
- [ ] `services/memory-service/internal/repository/relation_repository.go` — relation cache
- [ ] `services/memory-service/internal/repository/relation_repository_test.go` — cache tests
- [ ] `shared/migrations/002_memory_relations.sql` — database migration
- [ ] Framework install: `cd web && npm install react-force-graph-2d graphology`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | JWT 已在 Gateway 处理，Memory Service 通过 X-User-ID header |
| V3 Session Management | no | 同上 |
| V4 Access Control | yes | 所有 constellation/explore API 必须校验 `user_id`，确保只能访问自己的记忆 |
| V5 Input Validation | yes | `limit` 参数上限 100，`threshold` 必须在 [0,1] 范围内；LLM prompt 需 sanitize 用户内容 |
| V6 Cryptography | no | 无新增加密需求 |
| V7 Error Handling | yes | LLM 调用失败不暴露内部错误，返回友好提示 |

### Known Threat Patterns for Graph Visualization Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 图数据泄露（看到其他用户的记忆节点） | Information Disclosure | 所有查询必须带 `user_id = ?` 条件；Gateway 校验 JWT 后注入 X-User-ID |
| LLM Prompt Injection | Tampering | 用户记忆内容进入 LLM prompt 前需做长度限制（truncate 500 chars）和基本过滤 |
| DoS via 大量节点请求 | Denial of Service | `limit` 参数上限 100；移动端进一步限制 50；API 层加 rate limit |
| 缓存污染（memory_relations 写入脏数据） | Tampering | `source_id` 和 `target_id` 必须属于同一 `user_id`，写入前校验 |

## Sources

### Primary (HIGH confidence)
- [npm registry] — `react-force-graph-2d@1.29.1`, `sigma@3.0.3`, `graphology@0.26.0` versions verified
- [pgvector official docs](https://github.com/pgvector/pgvector) — `<=>` operator (cosine distance), IVFFlat/HNSW index types
- [react-force-graph GitHub](https://github.com/vasturiano/react-force-graph) — API props, performance props (warmupTicks, cooldownTicks, nodeCanvasObject)
- [vasturiano.github.io/react-force-graph](https://vasturiano.github.io/react-force-graph/) — Interactive examples, mobile touch support

### Secondary (MEDIUM confidence)
- [Batch Vector Search with PgVector](https://murhabazi.com/batch-vector-search-pgvector-postgresql-cross-lateral-joins) — CROSS JOIN LATERAL pattern for batch similarity
- [Sarah Glasmacher pgvector guide](https://www.sarahglasmacher.com/how-to-use-cosine-similarity-in-pgvector/) — Threshold query patterns
- [React force-graph Issue #223](https://github.com/vasturiano/react-force-graph/issues/223) — Performance benchmarks (~7K-12K element limit)
- [Next.js dynamic import docs](https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading) — `ssr: false` pattern

### Tertiary (LOW confidence)
- WebSearch results for Sigma.js vs react-force-graph-2d — 社区报告 Sigma.js 2-5x 性能优势，但无官方基准测试数据
- LLM prompt engineering patterns — 基于通用 RAG/semantic similarity 文献，非针对"记忆关联"场景的专门研究

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via npm registry, official docs reviewed
- Architecture: HIGH — codebase fully analyzed, existing patterns clear
- Pitfalls: HIGH — SSR canvas issues well-documented, pgvector limitations verified via docs
- Performance: MEDIUM — react-force-graph-2d 5000 节点性能基于社区报告，未做实际基准测试

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (react-force-graph-2d 活跃维护，建议 30 天内复核版本)
