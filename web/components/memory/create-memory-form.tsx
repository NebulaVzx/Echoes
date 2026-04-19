'use client'

import { useState, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { Toast, ToastContainer } from '@/components/ui/toast'

interface CreateMemoryFormProps {
  onSuccess?: () => void
}

type ContentType = 'text' | 'link'

export default function CreateMemoryForm({ onSuccess }: CreateMemoryFormProps) {
  const [contentType, setContentType] = useState<ContentType>('text')
  const [textContent, setTextContent] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [tagList, setTagList] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  // Tag input: Enter, comma, or space creates a tag
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const raw = tagInput.trim()
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault()
      if (raw && !tagList.includes(raw)) {
        setTagList((prev) => [...prev, raw])
      }
      setTagInput('')
      return
    }
    if (e.key === 'Backspace' && tagInput === '' && tagList.length > 0) {
      setTagList((prev) => prev.slice(0, -1))
    }
  }

  // Paste handling: split by comma/space/newline
  const handleTagPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text')
    if (pasted.includes(',') || pasted.includes(' ') || pasted.includes('\n')) {
      e.preventDefault()
      const newTags = pasted
        .split(/[,\s\n]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && !tagList.includes(t))
      if (newTags.length > 0) {
        setTagList((prev) => [...prev, ...newTags])
      }
    }
  }

  const removeTag = (tag: string) => {
    setTagList((prev) => prev.filter((t) => t !== tag))
    tagInputRef.current?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    dismissToast()

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
        showToast('请输入内容', 'error')
        return
      }
      data.text_content = textContent.trim()
    } else {
      if (!linkUrl.trim()) {
        showToast('请输入链接', 'error')
        return
      }
      data.link_url = linkUrl.trim()
    }

    if (tagList.length > 0) {
      data.tags = tagList
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
        setTagList([])
        setTagInput('')
        setNote('')
        showToast('记忆已保存', 'success')
        onSuccess?.()
      } else {
        showToast(response.error?.message || '创建失败', 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '发生错误', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={dismissToast}
          />
        )}
      </ToastContainer>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-5 min-h-[360px] flex flex-col">
        {/* Content type toggle */}
        <div className="flex gap-2 mb-4">
          {(['text', 'link'] as ContentType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setContentType(type)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                contentType === type
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {type === 'text' ? '文字' : '链接'}
            </button>
          ))}
        </div>

        {/* Content input */}
        <div className="mb-3">
          {contentType === 'text' ? (
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="记下你的想法..."
              rows={4}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors resize-none text-sm"
            />
          ) : (
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm"
            />
          )}
        </div>

        {/* Tags — chip input */}
        <div
          className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm mb-3 focus-within:ring-2 focus-within:ring-gray-400 dark:focus-within:ring-gray-500 transition-colors"
          onClick={() => tagInputRef.current?.focus()}
        >
          {tagList.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded text-xs"
            >
              {tag}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(tag)
                }}
                className="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={tagInputRef}
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onPaste={handleTagPaste}
            placeholder={tagList.length === 0 ? '标签，回车添加' : ''}
            className="flex-1 min-w-[80px] bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm py-0.5"
          />
        </div>

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
    </>
  )
}
