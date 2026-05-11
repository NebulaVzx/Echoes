'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { api, Memory } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Pencil, Check, X, Download, ArrowLeft, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface WeaveEditorProps {
  memory: Memory
  onUpdate?: (updated: Memory) => void
}

export default function WeaveEditor({ memory, onUpdate }: WeaveEditorProps) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(memory.text_content || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const response = await api.updateMemory(memory.id, { text_content: content })
      if (response.success && response.data) {
        setEditing(false)
        onUpdate?.(response.data)
      } else {
        setError(response.error?.message || '保存失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存请求失败')
    } finally {
      setSaving(false)
    }
  }, [memory.id, content, onUpdate])

  const handleCancel = useCallback(() => {
    setContent(memory.text_content || '')
    setEditing(false)
    setError(null)
  }, [memory.text_content])

  const handleExportMarkdown = useCallback(() => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `weave-${memory.id.slice(0, 8)}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [content, memory.id])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Link
          href="/weave"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回编织列表
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportMarkdown}>
            <Download className="w-3.5 h-3.5 mr-1" />
            导出 Markdown
          </Button>
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                <X className="w-3.5 h-3.5 mr-1" />
                取消
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 mr-1" />
                )}
                保存
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1" />
              编辑
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Content */}
      {editing ? (
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[500px] font-mono text-sm leading-relaxed"
          placeholder="开始编辑..."
        />
      ) : (
        <article className="prose dark:prose-invert prose-sm max-w-none bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 sm:p-8">
          <ReactMarkdown>{content || '*暂无内容*'}</ReactMarkdown>
        </article>
      )}
    </div>
  )
}
