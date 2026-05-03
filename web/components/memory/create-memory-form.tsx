'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { api, CreateMemoryResponse } from '@/lib/api'
import { Toast, ToastContainer } from '@/components/ui/toast'
import { Sparkles, Star, FileText, Upload, X, BookOpen, Code, Lightbulb, CheckSquare } from 'lucide-react'
import StreakIndicator from '@/components/warmth/streak-indicator'
import TimeCapsuleToggle from '@/components/warmth/time-capsule-toggle'
import AISuggestionCard from './ai-suggestion-card'

interface CreateMemoryFormProps {
  onSuccess?: () => void
}

type ContentType = 'text' | 'link' | 'file'

interface Template {
  id: string
  label: string
  icon: React.ReactNode
  placeholder: string
}

const templates: Template[] = [
  { id: 'blank', label: '空白', icon: null, placeholder: '记下你的想法...' },
  { id: 'code', label: '代码片段', icon: <Code className="w-3.5 h-3.5" />, placeholder: '```language\n// 粘贴代码\n```' },
  { id: 'reading', label: '读书笔记', icon: <BookOpen className="w-3.5 h-3.5" />, placeholder: '书名：《》\n章节：\n要点：' },
  { id: 'idea', label: '灵感速记', icon: <Lightbulb className="w-3.5 h-3.5" />, placeholder: '突然想到...' },
  { id: 'todo', label: '待办事项', icon: <CheckSquare className="w-3.5 h-3.5" />, placeholder: '- [ ] 任务1\n- [ ] 任务2' },
]

export default function CreateMemoryForm({ onSuccess }: CreateMemoryFormProps) {
  const [contentType, setContentType] = useState<ContentType>('text')
  const [textContent, setTextContent] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [tagList, setTagList] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [note, setNote] = useState('')
  const [source, setSource] = useState('')
  const [isStarred, setIsStarred] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [enableAISuggestion, setEnableAISuggestion] = useState(false)
  const [sealedUntil, setSealedUntil] = useState<string | null>(null)
  const [lastCreatedMemory, setLastCreatedMemory] = useState<CreateMemoryResponse | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load global AI suggestion preference on mount
  useEffect(() => {
    api.getSettings().then((response) => {
      if (response.success && response.data?.ai_suggestion_enabled) {
        setEnableAISuggestion(true)
      }
    }).catch(() => {
      // Silently fail — default to false
    })
  }, [])

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId)
    const tpl = templates.find(t => t.id === templateId)
    if (tpl && tpl.id !== 'blank') {
      setTextContent('')
    }
  }

  const getPlaceholder = () => {
    const tpl = templates.find(t => t.id === selectedTemplate)
    return tpl?.placeholder || '记下你的想法...'
  }

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

  // File drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = (file: File) => {
    const allowed = ['.txt', '.md', '.docx']
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!allowed.includes(ext)) {
      showToast('仅支持 .txt, .md, .docx 文件', 'error')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('文件大小不能超过 10MB', 'error')
      return
    }
    setUploadedFile(file)
  }

  const clearFile = () => {
    setUploadedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const resetForm = () => {
    setTextContent('')
    setLinkUrl('')
    setTagList([])
    setTagInput('')
    setNote('')
    setSource('')
    setIsStarred(false)
    setSealedUntil(null)
    setSelectedTemplate('blank')
    setUploadedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    dismissToast()

    // File upload mode
    if (contentType === 'file') {
      if (!uploadedFile) {
        showToast('请选择要上传的文件', 'error')
        return
      }

      const formData = new FormData()
      formData.append('file', uploadedFile)
      formData.append('content_type', 'file')
      if (source) formData.append('source', source)
      if (isStarred) formData.append('is_starred', 'true')
      if (note) formData.append('note', note)
      if (enableAISuggestion) formData.append('enable_ai_suggestion', 'true')
      if (tagList.length > 0) formData.append('tags', tagList.join(','))
      if (sealedUntil) formData.append('sealed_until', sealedUntil)

      setIsSubmitting(true)
      try {
        const response = await api.createMemory(formData)
        if (response.success && response.data) {
          resetForm()
          setLastCreatedMemory(response.data)
          showToast('文件已存入记忆匣', 'success')
          onSuccess?.()
        } else {
          showToast(response.error?.message || '上传失败', 'error')
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : '发生错误', 'error')
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    // Text / Link mode
    const data: {
      content_type: 'text' | 'link'
      text_content?: string
      link_url?: string
      tags?: string[]
      note?: string
      source?: string
      is_starred?: boolean
      enable_ai_suggestion?: boolean
      sealed_until?: string
    } = {
      content_type: contentType,
      enable_ai_suggestion: enableAISuggestion,
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

    if (tagList.length > 0) data.tags = tagList
    if (note.trim()) data.note = note.trim()
    if (source.trim()) data.source = source.trim()
    if (isStarred) data.is_starred = true
    if (sealedUntil) data.sealed_until = sealedUntil

    setIsSubmitting(true)
    try {
      const response = await api.createMemory(data)
      if (response.success && response.data) {
        resetForm()
        setLastCreatedMemory(response.data)
        showToast('记忆已存入记忆匣', 'success')
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
        {/* Branded header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>记忆匣</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </h2>
          <StreakIndicator />
        </div>

        {/* Content type toggle */}
        <div className="flex gap-2 mb-4">
          {(['text', 'link', 'file'] as ContentType[]).map((type) => (
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
              {type === 'text' ? '文字' : type === 'link' ? '链接' : '文件'}
            </button>
          ))}
        </div>

        {/* Template selector (only for text mode) */}
        {contentType === 'text' && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleTemplateChange(tpl.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                  selectedTemplate === tpl.id
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                {tpl.icon}
                {tpl.label}
              </button>
            ))}
          </div>
        )}

        {/* Content input */}
        <div className="mb-3">
          {contentType === 'file' ? (
            <div
              className={`relative h-[120px] rounded-md border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer ${
                dragActive
                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.docx"
                onChange={handleFileInput}
                className="hidden"
              />
              {uploadedFile ? (
                <div className="flex items-center gap-2 px-3">
                  <FileText className="w-5 h-5 text-purple-500" />
                  <div className="text-left">
                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{uploadedFile.name}</p>
                    <p className="text-xs text-gray-400">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); clearFile() }}
                    className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-gray-400" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">点击或拖拽上传文件</p>
                  <p className="text-xs text-gray-400">支持 .txt, .md, .docx（最大 10MB）</p>
                </>
              )}
            </div>
          ) : (
            <div className="h-[120px] px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md focus-within:ring-2 focus-within:ring-gray-400 dark:focus-within:ring-gray-500 transition-colors flex flex-col">
              {contentType === 'text' ? (
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder={getPlaceholder()}
                  className="w-full flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none text-sm"
                />
              ) : (
                <textarea
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none text-sm"
                />
              )}
            </div>
          )}
        </div>

        {/* Source input */}
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="来源（书名、文章、会议等，可选）"
          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm mb-3"
        />

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
          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors text-sm mb-3"
        />

        {/* AI Suggestion Toggle */}
        <div className="flex items-center justify-between py-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              AI 建议
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enableAISuggestion}
              onChange={(e) => setEnableAISuggestion(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-400 dark:peer-focus:ring-amber-500 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-gray-500 peer-checked:bg-amber-500 dark:peer-checked:bg-amber-600" />
          </label>
        </div>

        {/* Time Capsule Toggle */}
        <div className="mb-4">
          <TimeCapsuleToggle sealedUntil={sealedUntil} onChange={setSealedUntil} />
        </div>

        {/* Submit row: Star + Submit */}
        <div className="flex items-center gap-3 mt-auto">
          <button
            type="button"
            onClick={() => setIsStarred(!isStarred)}
            className={`p-2 rounded-md transition-colors ${
              isStarred
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-500'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:text-amber-400'
            }`}
            title={isStarred ? '取消星标' : '标记星标'}
          >
            <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400' : ''}`} />
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed btn-scale"
          >
            {isSubmitting ? '保存中...' : '存入记忆匣'}
          </button>
        </div>
      </form>

      {/* AI Suggestion Card */}
      {lastCreatedMemory && lastCreatedMemory.suggestion_status !== 'skipped' && (
        <AISuggestionCard
          key={lastCreatedMemory.memory.id}
          memoryId={lastCreatedMemory.memory.id}
          suggestionStatus={lastCreatedMemory.suggestion_status}
          onDismiss={() => setLastCreatedMemory(null)}
        />
      )}
    </>
  )
}
