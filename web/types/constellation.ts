// Graph node representing a memory in the constellation
// NOTE: color is computed by useConstellationData (centralized), NOT in ConstellationGraph
export interface GraphNode {
  id: string
  label: string
  group: string
  val: number
  isStarred: boolean
  contentType: 'text' | 'link' | 'file'
  color: string
  x?: number
  y?: number
}

// Graph edge representing similarity connection
export interface GraphEdge {
  source: string
  target: string
  value: number
}

// Graph data structure for react-force-graph-2d
export interface GraphData {
  nodes: GraphNode[]
  links: GraphEdge[]
}

// Explore state for drill-down tracking
export interface ExploreState {
  memoryId: string
  label: string
}

// Constellation API response
export interface ConstellationResponse {
  nodes: Array<{
    id: string
    content_type: string
    text_content?: string
    link_title?: string
    tags: string[]
    is_starred: boolean
    created_at: string
  }>
  edges: Array<{
    source: string
    target: string
    similarity: number
  }>
  has_more: boolean
  total: number
}

// Explore API response — flat structure matching backend
// Backend returns: { ...safeMemory, similarity, reason }
export interface ExploreResponse {
  memory_id: string
  results: Array<{
    id: string
    user_id: string
    content_type: 'text' | 'link' | 'file'
    text_content?: string
    link_url?: string
    link_title?: string
    link_summary?: string
    tags: string[]
    note?: string
    source?: string
    is_starred?: boolean
    cover_url?: string
    file_name?: string
    file_size?: number
    processing_status: string
    visibility: string
    sealed_until?: string
    created_at: string
    updated_at: string
    similarity: number
    reason: string
  }>
  breadcrumb: Array<{
    id: string
    label: string
  }>
}
