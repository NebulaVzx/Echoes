'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Flame } from 'lucide-react'

interface StreakData {
  current_streak: number
  longest_streak: number
  has_recorded_today: boolean
}

export default function StreakIndicator() {
  const [streak, setStreak] = useState<StreakData | null>(null)

  useEffect(() => {
    api.getStreaks().then((res) => {
      if (res.success && res.data) {
        setStreak(res.data)
      }
    }).catch(() => {})
  }, [])

  if (!streak) return null

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-3">
      {streak.has_recorded_today ? (
        <>
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span>已连续记录 {streak.current_streak} 天</span>
        </>
      ) : streak.current_streak > 0 ? (
        <>
          <Flame className="w-3.5 h-3.5 text-orange-300" />
          <span>当前连续 {streak.current_streak} 天，今天还没记录哦</span>
        </>
      ) : (
        <>
          <span className="text-gray-400">✨ 今天的第一条记忆，从这里开始</span>
        </>
      )}
    </div>
  )
}
