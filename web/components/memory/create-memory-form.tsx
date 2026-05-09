'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { api, CreateMemoryResponse } from '@/lib/api'
import { Toast, ToastContainer } from '@/components/ui/toast'
import { Sparkles, Star, FileText, Upload, X, BookOpen, Code, Lightbulb, CheckSquare, FilePlus } from 'lucide-react'
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

// Detect if pasted text is a URL
const isURL = (text: string): boolean => {
  const trimmed = text.trim()
  return /^https?:\/\/.+/i.test(trimmed) && trimmed.length < 2048
}

// Detect if text looks like code
const isCode = (text: string): boolean => {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return false
  const codeIndicators = [
    /^(func|def|class|const|let|var|import|from|#include|using|package)\s/,
    /[{};]=/,
    /^(\s{2,}|\t).*[{};=]/,
    /```[a-z]*/,
    /^(if|for|while|return)\s*\(/,
    /^(\{|\}|\[|\])/,
  ]
  let matched = 0
  for (const line of lines.slice(0, 10)) {
    for (const pattern of codeIndicators) {
      if (pattern.test(line)) {
        matched++
        break
      }
    }
  }
  return matched >= 2
}

// Detect if text looks like a todo list
const isTodoList = (text: string): boolean => {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return false
  const todoPatterns = [/^- \[.\]/, /^\* \[.\]/, /^\d+\. \[.\]/, /^- \[ \]/]
  const matched = lines.filter(l => todoPatterns.some(p => p.test(l.trim()))).length
  return matched >= Math.min(2, lines.length * 0.3)
}

// Detect if text looks like a reading note
const isReadingNote = (text: string): boolean => {
  const indicators = [
    /书名[：:]/,
    /作者[：:]/,
    /章节[：:]/,
    /第[一二三四五六七八九十\d]+章/,
    /要点[：:]/,
    /摘录[：:]/,
    /笔记[：:]/,
    /^#+\s/,
  ]
  return indicators.some(p => p.test(text))
}

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
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [pasteDetected, setPasteDetected] = useState<string | null>(null)
  const [batchResults, setBatchResults] = useState<{ success: number; failed: number } | null>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const DRAFT_KEY = 'echoes:create-memory:draft'

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft) {
        const parsed = JSON.parse(draft)
        if (parsed.contentType) setContentType(parsed.contentType)
        if (parsed.textContent) setTextContent(parsed.textContent)
        if (parsed.linkUrl) setLinkUrl(parsed.linkUrl)
        if (parsed.tagList) setTagList(parsed.tagList)
        if (parsed.note) setNote(parsed.note)
        if (parsed.source) setSource(parsed.source)
        if (typeof parsed.isStarred === 'boolean') setIsStarred(parsed.isStarred)
        if (parsed.selectedTemplate) setSelectedTemplate(parsed.selectedTemplate)
      }
    } catch {
      // Silently fail — corrupted draft
    }
  }, [])

  // Auto-save draft on change (debounce 2s)
  useEffect(() => {
    const timer = setTimeout(() => {
      const draft = {
        contentType,
        textContent,
        linkUrl,
        tagList,
        note,
        source,
        isStarred,
        selectedTemplate,
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    }, 2000)
    return () => clearTimeout(timer)
  }, [contentType, textContent, linkUrl, tagList, note, source, isStarred, selectedTemplate])

  // Clear paste-detected toast after 3s
  useEffect(() => {
    if (pasteDetected) {
      const timer = setTimeout(() => setPasteDetected(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [pasteDetected])

  // Clear batch results toast after 5s
  useEffect(() => {
    if (batchResults) {
      const timer = setTimeout(() => setBatchResults(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [batchResults])

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

  // Smart paste detection in text mode
  const handleTextPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text')
    if (!pasted || pasted.length > 10000) return

    if (isURL(pasted)) {
      e.preventDefault()
      setLinkUrl(pasted.trim())
      setContentType('link')
      setPasteDetected('检测到链接，已自动切换')
      return
    }

    if (isTodoList(pasted) && selectedTemplate !== 'todo') {
      setSelectedTemplate('todo')
      setPasteDetected('检测到待办列表，已自动选择模板')
      return
    }

    if (isCode(pasted) && selectedTemplate !== 'code') {
      setSelectedTemplate('code')
      setPasteDetected('检测到代码，已自动选择模板')
      return
    }

    if (isReadingNote(pasted) && selectedTemplate !== 'reading') {
      setSelectedTemplate('reading')
      setPasteDetected('检测到读书笔记，已自动选择模板')
      return
    }
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files)
      handleFiles(files)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      handleFiles(files)
    }
  }

  const handleFiles = (files: File[]) => {
    const allowed = ['.txt', '.md', '.docx']
    const validFiles: File[] = []
    const maxTotalSize = 50 * 1024 * 1024 // 50MB total limit

    for (const file of files) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      if (!allowed.includes(ext)) {
        showToast(`跳过不支持的文件: ${file.name}`, 'error')
        continue
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast(`文件超过 10MB: ${file.name}`, 'error')
        continue
      }
      validFiles.push(file)
    }

    const currentTotal = uploadedFiles.reduce((sum, f) => sum + f.size, 0)
    const newTotal = validFiles.reduce((sum, f) => sum + f.size, 0)
    if (currentTotal + newTotal > maxTotalSize) {
      showToast('批量文件总大小不能超过 50MB', 'error')
      return
    }

    setUploadedFiles((prev) => [...prev, ...validFiles])
  }

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setUploadedFiles([])
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
    setUploadedFiles([])
    setPasteDetected(null)
    setBatchResults(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      // Ignore
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    dismissToast()

    // File upload mode
    if (contentType === 'file') {
      if (uploadedFiles.length === 0) {
        showToast('请选择要上传的文件', 'error')
        return
      }

      // Batch upload: each file becomes a separate memory
      if (uploadedFiles.length > 1) {
        setIsSubmitting(true)
        let successCount = 0
        let failedCount = 0
        const errors: string[] = []

        for (const file of uploadedFiles) {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('content_type', 'file')
          if (source) formData.append('source', source)
          if (isStarred) formData.append('is_starred', 'true')
          if (note) formData.append('note', note)
          if (enableAISuggestion) formData.append('enable_ai_suggestion', 'true')
          if (tagList.length > 0) formData.append('tags', tagList.join(','))
          if (sealedUntil) formData.append('sealed_until', sealedUntil)

          try {
            const response = await api.createMemory(formData)
            if (response.success && response.data) {
              successCount++
              if (successCount === 1) {
                setLastCreatedMemory(response.data)
              }
            } else {
              failedCount++
              errors.push(`${file.name}: ${response.error?.message || '失败'}`)
            }
          } catch (err) {
            failedCount++
            errors.push(`${file.name}: ${err instanceof Error ? err.message : '错误'}`)
          }
        }

        setBatchResults({ success: successCount, failed: failedCount })
        if (failedCount > 0 && successCount > 0) {
          showToast(`批量导入: ${successCount} 成功, ${failedCount} 失败`, 'error')
        } else if (failedCount > 0) {
          showToast(`批量导入失败: ${errors[0]}`, 'error')
        } else {
          showToast(`成功导入 ${successCount} 个文件`, 'success')
        }

        if (successCount > 0) {
          resetForm()
          onSuccess?.()
        } else {
          setUploadedFiles([])
        }
        setIsSubmitting(false)
        return
      }

      // Single file upload
      const file = uploadedFiles[0]
      const formData = new FormData()
      formData.append('file', file)
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

        {/* Smart paste notification */}
        {pasteDetected && (
          <div className="mb-3 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 text-xs rounded-md flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {pasteDetected}
          </div>
        )}

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
              className={`relative min-h-[120px] rounded-md border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer ${
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
                multiple
                onChange={handleFileInput}
                className="hidden"
              />
              {uploadedFiles.length > 0 ? (
                <div className="w-full px-3 py-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      已选择 {uploadedFiles.length} 个文件
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); clearFiles() }}
                      className="text-xs text-red-500 hover:text-red-600"
                    >
                      清空全部
                    </button>
                  </div>
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 py-1 px-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                      <FileText className="w-4 h-4 text-purple-500 shrink-0" />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{file.name}</p>
                        <p className="text-[10px] text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeFile(idx) }}
                        className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 shrink-0"
                      >
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                    className="w-full py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border border-dashed border-gray-300 dark:border-gray-600 rounded-md flex items-center justify-center gap-1"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    继续添加文件
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-gray-400" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">点击或拖拽上传文件</p>
                  <p className="text-xs text-gray-400">支持 .txt, .md, .docx（单文件最大 10MB）</p>
                </>
              )}
            </div>
          ) : (
            <div className="h-[120px] px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md focus-within:ring-2 focus-within:ring-gray-400 dark:focus-within:ring-gray-500 transition-colors flex flex-col">
              {contentType === 'text' ? (
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  onPaste={handleTextPaste}
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
            {isSubmitting
              ? (contentType === 'file' && uploadedFiles.length > 1 ? `导入中...` : '保存中...')
              : (contentType === 'file' && uploadedFiles.length > 1 ? `导入 ${uploadedFiles.length} 个文件` : '存入记忆匣')
            }
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
