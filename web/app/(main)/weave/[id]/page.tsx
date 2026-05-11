'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api, Memory } from '@/lib/api'
import WeaveEditor from '@/components/weave/weave-editor'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText } from 'lucide-react'

export default function WeaveDetailPage() {
  const { id } = useParams()
  const [memory, setMemory] = useState<Memory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || typeof id !== 'string') return
    const fetchMemory = async () => {
      try {
        setLoading(true)
        const response = await api.getMemory(id)
        if (response.success && response.data) {
          setMemory(response.data)
        } else {
          setError('加载失败')
        }
      } catch {
        setError('加载编织内容失败')
      } finally {
        setLoading(false)
      }
    }
    fetchMemory()
  }, [id])

  if (loading) {
    return (
      <div className="mx-auto max-w-content-timeline px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error || !memory) {
    return (
      <div className="mx-auto max-w-content-timeline px-4 py-6">
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{error || '编织内容不存在'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-content-timeline px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">{memory.text_content?.slice(0, 30) || '编织内容'}...</h1>
        <p className="text-xs text-gray-400 mt-1">
          {new Date(memory.created_at).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
      <WeaveEditor memory={memory} onUpdate={setMemory} />
    </div>
  )
}
