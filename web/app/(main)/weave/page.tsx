import { type Metadata } from 'next'

export const metadata: Metadata = {
  title: '记忆编织 - Echoes',
}

export default function WeavePage() {
  return (
    <div className="mx-auto max-w-content-timeline px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">记忆编织</h1>
      <p className="text-muted-foreground">AI 将多条记忆编织成连贯文章 — 即将在 Phase 14 上线。</p>
    </div>
  )
}
