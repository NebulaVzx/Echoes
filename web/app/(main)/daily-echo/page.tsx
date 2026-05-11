import { type Metadata } from 'next'

export const metadata: Metadata = {
  title: '每日回响 - Echoes',
}

export default function DailyEchoPage() {
  return (
    <div className="mx-auto max-w-content-timeline px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">每日回响</h1>
      <p className="text-muted-foreground">每天一条旧记忆的回响推送 — 即将在 Phase 15 上线。</p>
    </div>
  )
}
