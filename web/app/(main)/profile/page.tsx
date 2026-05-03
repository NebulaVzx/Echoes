import { type Metadata } from 'next'

export const metadata: Metadata = {
  title: '个人画像 - Echoes',
}

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-content-timeline px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">个人画像</h1>
      <p className="text-muted-foreground">记忆 DNA、AI 助手人格、数据主权 — 即将在 Phase 16 上线。</p>
    </div>
  )
}
