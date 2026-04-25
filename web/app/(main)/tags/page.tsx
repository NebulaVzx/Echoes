'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { api, TagInfo, TagCategory } from '@/lib/api'
import { useAuth } from '@/app/providers/auth-provider'
import Logo from '@/components/logo'
import SearchInput from '@/components/search/search-input'
import ThemeToggle from '@/components/theme-toggle'
import { Skeleton } from '@/components/ui/skeleton'
import { Toast, ToastContainer } from '@/components/ui/toast'
import { getTagStyle, TAG_COLOR_PRESETS } from '@/components/memory/tag-filter-bar'
import {
  LayoutGrid,
  Cloud,
  GitMerge,
  X,
  Check,
  ChevronLeft,
  Wand2,
  Tag,
  Sparkles,
  FolderOpen,
} from 'lucide-react'

type ViewMode = 'cloud' | 'cards'

const TAG_PRESET_COLORS = Object.keys(TAG_COLOR_PRESETS)

function TagCloudSkeleton() {
  return (
    <div className="flex flex-wrap gap-3 items-center justify-center py-12">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="h-8 rounded-full" style={{ width: `${60 + Math.random() * 80}px` }} />
      ))}
    </div>
  )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}

export default function TagsPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [tags, setTags] = useState<TagInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('cloud')
  const [tagColors, setTagColors] = useState<Record<string, string>>({})
  const [tagCategories, setTagCategories] = useState<TagCategory[] | null>(null)
  const [isCategorizing, setIsCategorizing] = useState(false)
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [mergeSource, setMergeSource] = useState('')
  const [mergeTarget, setMergeTarget] = useState('')
  const [similarTags, setSimilarTags] = useState<{ canonical: string; duplicate: string }[]>([])
  const [isMerging, setIsMerging] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type })
  const dismissToast = () => setToast(null)

  const loadTags = useCallback(async () => {
    try {
      setIsLoading(true)
      const [tagsResponse, settingsResponse] = await Promise.all([
        api.getTags(),
        api.getSettings(),
      ])
      if (tagsResponse.success && tagsResponse.data) {
        setTags(tagsResponse.data.tags)
      }
      if (settingsResponse.success && settingsResponse.data?.tag_metadata) {
        const colors: Record<string, string> = {}
        Object.entries(settingsResponse.data.tag_metadata).forEach(([name, meta]) => {
          if (meta.color) colors[name] = meta.color
        })
        setTagColors(colors)
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '加载失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTags()
  }, [loadTags])

  const handleColorChange = async (tagName: string, color: string) => {
    const newColors = { ...tagColors, [tagName]: color }
    setTagColors(newColors)
    try {
      await api.updateSettings({
        tags: { [tagName]: { color } },
      })
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存颜色失败', 'error')
    }
  }

  const handleRemoveColor = async (tagName: string) => {
    const newColors = { ...tagColors }
    delete newColors[tagName]
    setTagColors(newColors)
    try {
      await api.updateSettings({
        tags: { [tagName]: { color: '' } },
      })
    } catch (err) {
      showToast(err instanceof Error ? err.message : '移除颜色失败', 'error')
    }
  }

  const handleMerge = async () => {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return
    setIsMerging(true)
    try {
      const response = await api.mergeTags(mergeSource, mergeTarget)
      if (response.success) {
        showToast(`已将 ${mergeSource} 合并到 ${mergeTarget}`, 'success')
        setMergeDialogOpen(false)
        setMergeSource('')
        setMergeTarget('')
        loadTags()
      } else {
        showToast(response.error?.message || '合并失败', 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '合并失败', 'error')
    } finally {
      setIsMerging(false)
    }
  }

  const handleFindSimilar = async () => {
    try {
      const response = await api.getSimilarTags()
      if (response.success && response.data) {
        setSimilarTags(response.data.pairs)
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '检测失败', 'error')
    }
  }

  const handleCategorize = async () => {
    setIsCategorizing(true)
    try {
      const response = await api.categorizeTags()
      if (response.success && response.data) {
        setTagCategories(response.data.categories)
        showToast('分类完成', 'success')
      } else {
        showToast(response.error?.message || '分类失败', 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '分类失败', 'error')
    } finally {
      setIsCategorizing(false)
    }
  }

  const openMergeDialog = (source: string, target: string) => {
    setMergeSource(source)
    setMergeTarget(target)
    setMergeDialogOpen(true)
  }

  // Calculate font size for cloud view: min(24px, 12px + log2(count+1)*2)
  const getFontSize = (count: number) => {
    return Math.min(24, 12 + Math.log2(count + 1) * 2)
  }

  // Build a tag lookup map for quick access
  const tagMap = tags.reduce((acc, t) => {
    acc[t.name] = t
    return acc
  }, {} as Record<string, TagInfo>)

  // If categorized, build grouped tags; otherwise show all tags flat
  const hasCategories = tagCategories && tagCategories.length > 0

  // Collect uncategorized tags
  const categorizedTagNames = new Set<string>()
  if (hasCategories) {
    tagCategories!.forEach((cat) => cat.tags.forEach((t) => categorizedTagNames.add(t)))
  }
  const uncategorizedTags = hasCategories
    ? tags.filter((t) => !categorizedTagNames.has(t.name))
    : []

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ToastContainer>
        {toast && <Toast message={toast.message} type={toast.type} onClose={dismissToast} />}
      </ToastContainer>

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Logo size={28} className="text-gray-900 dark:text-gray-100" />
            <Link href="/" className="text-lg font-semibold text-gray-900 dark:text-gray-50 hover:opacity-80 transition-opacity">
              Echoes
            </Link>
          </div>
          <SearchInput />
          <div className="flex items-center gap-2 flex-shrink-0">
            <ThemeToggle />
            {user && (
              <span className="text-sm text-gray-600 dark:text-gray-300 hidden sm:inline max-w-[120px] truncate">
                {user.username || user.email}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Title & Controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">标签管理</h1>
            <span className="text-xs text-gray-400 dark:text-gray-500">{tags.length} 个标签</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCategorize}
              disabled={isCategorizing || tags.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isCategorizing ? '分类中...' : '自动分类'}
            </button>
            <button
              onClick={handleFindSimilar}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              智能整理
            </button>
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
              <button
                onClick={() => setViewMode('cloud')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'cloud'
                    ? 'bg-white dark:bg-gray-600 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                title="云视图"
              >
                <Cloud className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-gray-600 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                title="卡片视图"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Similar tags alert */}
        {similarTags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-lg"
          >
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">
              发现 {similarTags.length} 组相似标签
            </p>
            <div className="space-y-1.5">
              {similarTags.map((pair, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    {pair.duplicate} → {pair.canonical}
                  </span>
                  <button
                    onClick={() => openMergeDialog(pair.duplicate, pair.canonical)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors"
                  >
                    <GitMerge className="w-3 h-3" />
                    合并
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Tag Views */}
        {isLoading ? (
          <TagCloudSkeleton />
        ) : tags.length === 0 ? (
          <div className="text-center py-16">
            <Tag className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">还没有标签，保存第一条记忆后会自动生成</p>
          </div>
        ) : hasCategories ? (
          /* Categorized view */
          <div className="space-y-8">
            {tagCategories!.map((category) => (
              <div key={category.name}>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5" />
                  {category.name}
                  <span className="text-xs text-gray-300 dark:text-gray-600">({category.tags.length})</span>
                </h3>
                {viewMode === 'cloud' ? (
                  <div className="flex flex-wrap gap-3 items-center py-2">
                    {category.tags.map((tagName) => {
                      const tag = tagMap[tagName]
                      if (!tag) return null
                      return (
                        <motion.button
                          key={tagName}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => router.push(`/?tags=${encodeURIComponent(tagName)}`)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full transition-colors hover:opacity-80 ${getTagStyle(
                            tagColors[tagName],
                            false
                          )}`}
                          style={{ fontSize: `${getFontSize(tag.count)}px` }}
                        >
                          {tagName}
                          <span className="text-[10px] opacity-60 ml-0.5">{tag.count}</span>
                        </motion.button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {category.tags.map((tagName) => {
                      const tag = tagMap[tagName]
                      if (!tag) return null
                      return (
                        <TagCard
                          key={tagName}
                          tag={tag}
                          tagColors={tagColors}
                          onColorChange={handleColorChange}
                          onRemoveColor={handleRemoveColor}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
            {/* Uncategorized tags */}
            {uncategorizedTags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5" />
                  其他
                  <span className="text-xs text-gray-300 dark:text-gray-600">({uncategorizedTags.length})</span>
                </h3>
                {viewMode === 'cloud' ? (
                  <div className="flex flex-wrap gap-3 items-center py-2">
                    {uncategorizedTags.map((tag) => (
                      <motion.button
                        key={tag.name}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => router.push(`/?tags=${encodeURIComponent(tag.name)}`)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full transition-colors hover:opacity-80 ${getTagStyle(
                          tagColors[tag.name],
                          false
                        )}`}
                        style={{ fontSize: `${getFontSize(tag.count)}px` }}
                      >
                        {tag.name}
                        <span className="text-[10px] opacity-60 ml-0.5">{tag.count}</span>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {uncategorizedTags.map((tag) => (
                      <TagCard
                        key={tag.name}
                        tag={tag}
                        tagColors={tagColors}
                        onColorChange={handleColorChange}
                        onRemoveColor={handleRemoveColor}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setTagCategories(null)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              清除分类，恢复默认视图
            </button>
          </div>
        ) : viewMode === 'cloud' ? (
          /* Flat cloud view */
          <div className="flex flex-wrap gap-3 items-center justify-center py-8">
            {tags.map((tag) => (
              <motion.button
                key={tag.name}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push(`/?tags=${encodeURIComponent(tag.name)}`)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full transition-colors hover:opacity-80 ${getTagStyle(
                  tagColors[tag.name],
                  false
                )}`}
                style={{ fontSize: `${getFontSize(tag.count)}px` }}
              >
                {tag.name}
                <span className="text-[10px] opacity-60 ml-0.5">{tag.count}</span>
              </motion.button>
            ))}
          </div>
        ) : (
          /* Flat cards view */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tags.map((tag) => (
              <TagCard
                key={tag.name}
                tag={tag}
                tagColors={tagColors}
                onColorChange={handleColorChange}
                onRemoveColor={handleRemoveColor}
              />
            ))}
          </div>
        )}
      </div>

      {/* Merge Dialog */}
      {mergeDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 w-full max-w-sm mx-4"
          >
            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">合并标签</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              将所有记忆里的「<span className="font-medium text-gray-700 dark:text-gray-300">{mergeSource}</span>」替换为「
              <span className="font-medium text-gray-700 dark:text-gray-300">{mergeTarget}</span>」
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => {
                  setMergeDialogOpen(false)
                  setMergeSource('')
                  setMergeTarget('')
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleMerge}
                disabled={isMerging}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {isMerging ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    合并中...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    确认合并
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  )
}

// TagCard sub-component for reuse in categorized and flat views
function TagCard({
  tag,
  tagColors,
  onColorChange,
  onRemoveColor,
}: {
  tag: TagInfo
  tagColors: Record<string, string>
  onColorChange: (name: string, color: string) => void
  onRemoveColor: (name: string) => void
}) {
  const router = useRouter()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 p-4"
    >
      <div className="flex items-start justify-between mb-3">
        <button
          onClick={() => router.push(`/?tags=${encodeURIComponent(tag.name)}`)}
          className={`inline-flex items-center px-2.5 py-1 text-sm rounded-full ${getTagStyle(
            tagColors[tag.name],
            false
          )}`}
        >
          {tag.name}
        </button>
        <span className="text-xs text-gray-400 dark:text-gray-500">{tag.count} 条记忆</span>
      </div>

      <div className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        最近更新: {formatDate(tag.last_updated_at)}
      </div>

      {tag.related_tags && tag.related_tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="text-xs text-gray-400 dark:text-gray-500">相关:</span>
          {tag.related_tags.slice(0, 3).map((r) => (
            <button
              key={r}
              onClick={() => router.push(`/?tags=${encodeURIComponent(r)}`)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Color picker */}
      <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100 dark:border-gray-700">
        <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">颜色:</span>
        {TAG_PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(tag.name, color)}
            className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${
              tagColors[tag.name] === color
                ? 'border-gray-400 dark:border-gray-300 scale-110'
                : 'border-gray-200 dark:border-gray-600'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
        {tagColors[tag.name] && (
          <button
            onClick={() => onRemoveColor(tag.name)}
            className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="移除颜色"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  )
}
