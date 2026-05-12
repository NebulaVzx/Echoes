'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Sparkles, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { api, DailyReviewWithEcho } from '@/lib/api'
import EchoStyleSelector from './echo-style-selector'
import EchoMessage from './echo-message'
import Link from 'next/link'

export default function EchoCard() {
  const [data, setData] = useState<DailyReviewWithEcho | null>(null)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('daily_review_collapsed') !== 'false'
  })
  const [style, setStyle] = useState(() => {
    if (typeof window === 'undefined') return 'warm'
    return localStorage.getItem('echo_style_preference') || 'warm'
  })
  const [echoLoading, setEchoLoading] = useState(false)

  const fetchData = useCallback(async (selectedStyle?: string) => {
    try {
      const res = await api.getDailyReview(selectedStyle || style)
      if (res.success && res.data) {
        setData(res.data)
      }
    } catch (err) {
      console.error('Failed to fetch daily review:', err)
    }
  }, [style])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('daily_review_collapsed', String(next))
  }

  const handleStyleChange = (newStyle: string) => {
    setStyle(newStyle)
    localStorage.setItem('echo_style_preference', newStyle)
    setEchoLoading(true)
    fetchData(newStyle).finally(() => setEchoLoading(false))
  }

  const handleRegenerate = () => {
    setEchoLoading(true)
    fetchData(style).finally(() => setEchoLoading(false))
  }

  if (!data) return null

  return (
    <div className="mb-5 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <button
        onClick={toggleCollapse}
        className="w-full flex items-center justify-between p-3 text-sm"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-sky-500" />
          <span className="font-medium text-gray-800 dark:text-gray-200">今日拾忆</span>
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        )}
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {data.today_count > 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  今天保存了 {data.today_count} 条记忆
                  {data.top_tags && data.top_tags.length > 0 && (
                    <>，主题：{data.top_tags.map(t => `#${t}`).join(' ')}</>
                  )}
                </p>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  今天也要记得拾起些什么 ✨
                </p>
              )}

              {data.worth_reviewing && (
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">值得回顾</p>
                  <Link href={`/memory/${data.worth_reviewing.id}`}>
                    <p className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                      {data.worth_reviewing.text_content
                        ? data.worth_reviewing.text_content.slice(0, 80) + '...'
                        : data.worth_reviewing.link_title}
                    </p>
                  </Link>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <EchoStyleSelector value={style} onChange={handleStyleChange} />
                  {data.echo_message && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={handleRegenerate}
                      disabled={echoLoading}
                    >
                      <RefreshCw className={`w-3 h-3 ${echoLoading ? 'animate-spin' : ''}`} />
                      重新生成
                    </Button>
                  )}
                </div>

                {data.echo_message ? (
                  <EchoMessage message={data.echo_message} isLoading={echoLoading} />
                ) : echoLoading ? (
                  <EchoMessage message="" isLoading={true} />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    今天还没有回响，点击生成一条温暖的记忆回响吧
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
