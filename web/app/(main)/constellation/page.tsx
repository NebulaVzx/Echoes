import { type Metadata } from 'next'

export const metadata: Metadata = {
  title: '记忆星图 - Echoes',
}

export default function ConstellationPage() {
  return (
    <div className="mx-auto max-w-content-timeline px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">记忆星图</h1>
      <p className="text-muted-foreground">可视化记忆关联网络 — 即将在 Phase 13 上线。</p>
    </div>
  )
}
