'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, Memory } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PenLine, FileText, BookOpen, ListTodo, Loader2, Sparkles } from 'lucide-react'

interface WeaveModalProps {
  open: boolean
  onClose: () => void
  selectedIds: string[]
  memories: Memory[]
  onSuccess?: () => void
}

type WeaveMode = 'article' | 'story' | 'summary' | 'todo'

const MODE_CONFIGS: Record<WeaveMode, { label: string; description: string; icon: typeof FileText }> = {
  article: { label: '文章', description: '将选中的记忆编织成一篇连贯的长文章', icon: FileText },
  story: { label: '故事', description: '以叙事方式串联记忆，创造引人入胜的故事', icon: BookOpen },
  summary: { label: '摘要', description: '提炼核心观点，生成简洁的摘要总结', icon: Sparkles },
  todo: { label: '待办', description: '从记忆中提取行动项，生成待办清单', icon: ListTodo },
}

export default function WeaveModal({ open, onClose, selectedIds, memories, onSuccess }: WeaveModalProps) {
  const router = useRouter()
  const [mode, setMode] = useState<WeaveMode>('article')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleWeave = async () => {
    if (selectedIds.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const response = await api.weaveMemories({
        source_ids: selectedIds,
        mode,
      })
      if (response.success && response.data) {
        onClose()
        onSuccess?.()
        router.push(`/weave/${response.data.memory.id}`)
      } else {
        setError(response.error?.message || '编织失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '编织请求失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="w-5 h-5" />
            记忆编织
          </DialogTitle>
          <DialogDescription>
            选择 {selectedIds.length} 条记忆的编织方式
          </DialogDescription>
        </DialogHeader>

        {/* Mode selection */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          {(Object.entries(MODE_CONFIGS) as [WeaveMode, typeof MODE_CONFIGS['article']][]).map(([key, config]) => {
            const Icon = config.icon
            return (
              <button
                key={key}
                onClick={() => setMode(key)}
                disabled={loading}
                className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-left ${
                  mode === key
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
                }`}
              >
                <Icon className={`w-5 h-5 ${mode === key ? 'text-primary' : 'text-gray-400'}`} />
                <div>
                  <p className="text-sm font-medium">{config.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{config.description}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Selected memories preview */}
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-2">已选记忆</p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {memories.map((m) => (
              <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
                <span className="text-gray-500 dark:text-gray-400">
                  {m.content_type === 'link' ? '链' : m.content_type === 'file' ? '档' : '文'}
                </span>
                <span className="truncate flex-1">
                  {m.text_content?.slice(0, 40) || m.link_title?.slice(0, 40) || m.file_name || '未命名'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 mt-2">{error}</p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleWeave} disabled={loading || selectedIds.length === 0}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                编织中...
              </>
            ) : (
              <>
                <PenLine className="w-4 h-4 mr-1.5" />
                开始编织
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
