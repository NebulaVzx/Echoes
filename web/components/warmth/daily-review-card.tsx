'use client'

import { useEffect, useState } from 'react'
import { api, Memory } from '@/lib/api'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import Link from 'next/link'

interface DailyReviewData {
  today_count: number
  top_tags: string[]
  worth_reviewing?: Memory
}

export default function DailyReviewCard() {
  const [data, setData] = useState<DailyReviewData | null>(null)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('daily_review_collapsed') === 'true'
  })

  useEffect(() => {
    api.getDailyReview().then((res) => {
      if (res.success && res.data) {
        setData(res.data)
      }
    }).catch(() => {})
  }, [])

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('daily_review_collapsed', String(next))
  }

  if (!data) return null

  return (
    <div className="mb-5 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <button
        onClick={toggleCollapse}
        className="w-full flex items-center justify-between p-3 text-sm"
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

      {!collapsed && (
        <div className="px-3 pb-3">
          {data.today_count > 0 ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                今天保存了 {data.today_count} 条记忆
                {data.top_tags.length > 0 && (
                  <>，主题：{data.top_tags.map(t => `#${t}`).join(' ')}</>
                )}
              </p>
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
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              今天也要记得拾起些什么 ✨
            </p>
          )}
        </div>
      )}
    </div>
  )
}
