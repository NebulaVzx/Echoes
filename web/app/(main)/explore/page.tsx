import { type Metadata } from 'next'

export const metadata: Metadata = {
  title: '探索模式 - Echoes',
}

export default function ExplorePage() {
  return (
    <div className="mx-auto max-w-content-timeline px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">探索模式</h1>
      <p className="text-muted-foreground">从任意记忆出发无限钻取关联内容 — 即将在 Phase 13 上线。</p>
    </div>
  )
}
