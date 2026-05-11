import { type Metadata } from 'next'

export const metadata: Metadata = {
  title: '情绪日历 - Echoes',
}

export default function MoodPage() {
  return (
    <div className="mx-auto max-w-content-timeline px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">情绪日历</h1>
      <p className="text-muted-foreground">记忆情绪分析与热力图日历 — 即将在 Phase 15 上线。</p>
    </div>
  )
}
