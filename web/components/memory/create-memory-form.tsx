'use client'

import { useState } from 'react'
import { api } from '@/lib/api'

interface CreateMemoryFormProps {
  onSuccess?: () => void
}

type ContentType = 'text' | 'link'

export default function CreateMemoryForm({ onSuccess }: CreateMemoryFormProps) {
  const [contentType, setContentType] = useState<ContentType>('text')
  const [textContent, setTextContent] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [tags, setTags] = useState('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const data: {
      content_type: 'text' | 'link'
      text_content?: string
      link_url?: string
      tags?: string[]
      note?: string
    } = {
      content_type: contentType,
    }

    if (contentType === 'text') {
      if (!textContent.trim()) {
        setError('请输入内容')
        return
      }
      data.text_content = textContent.trim()
    } else {
      if (!linkUrl.trim()) {
        setError('请输入链接')
        return
      }
      data.link_url = linkUrl.trim()
    }

    if (tags.trim()) {
      data.tags = tags.split(/[,\s]+/).filter(Boolean)
    }
    if (note.trim()) {
      data.note = note.trim()
    }

    setIsSubmitting(true)
    try {
      const response = await api.createMemory(data)
      if (response.success) {
        setTextContent('')
        setLinkUrl('')
        setTags('')
        setNote('')
        onSuccess?.()
      } else {
        setError(response.error?.message || '创建失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生错误')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-5">
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Content type toggle */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setContentType('text')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            contentType === 'text'
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          文字
        </button>
        <button
          type="button"
          onClick={() => setContentType('link')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            contentType === 'link'
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          链接
        </button>
      </div>

      {/* Content input */}
      {contentType === 'text' ? (
        <textarea
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          placeholder="记下你的想法..."
          rows={4}
          className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors resize-none text-sm mb-3"
        />
      ) : (
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm mb-3"
        />
      )}

      {/* Tags */}
      <input
        type="text"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="标签，用逗号或空格分隔"
        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm mb-3"
      />

      {/* Note */}
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="备注（可选）"
        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm mb-4"
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? '保存中...' : '保存记忆'}
      </button>
    </form>
  )
}
