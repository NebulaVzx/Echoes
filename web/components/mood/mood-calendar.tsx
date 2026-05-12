'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { scoreToColor } from '@/lib/mood-colors'
import { MoodDayData } from '@/lib/api'

interface MoodCalendarProps {
  data: MoodDayData[]
  year: number
  onDayClick?: (date: string, data: MoodDayData | null) => void
}

export default function MoodCalendar({ data, year, onDayClick }: MoodCalendarProps) {
  const dayMap = useMemo(() => {
    const map = new Map<string, MoodDayData>()
    data.forEach((d) => map.set(d.date, d))
    return map
  }, [data])

  const weeks = useMemo(() => {
    const result: (MoodDayData | null)[][] = []
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31)

    // Adjust to start from Sunday
    const firstDay = new Date(startDate)
    firstDay.setDate(firstDay.getDate() - firstDay.getDay())

    let currentWeek: (MoodDayData | null)[] = []
    let currentDate = new Date(firstDay)

    while (currentDate <= endDate || currentWeek.length > 0) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const dayData = dayMap.get(dateStr) || null
      currentWeek.push(dayData)

      if (currentWeek.length === 7) {
        result.push(currentWeek)
        currentWeek = []
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return result
  }, [dayMap, year])

  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-[800px]">
        <div className="flex gap-[3px]">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[3px]">
              {week.map((day, dayIndex) => {
                const index = weekIndex * 7 + dayIndex
                const score = day?.score ?? null
                const color = scoreToColor(score, isDark)
                const dateStr = day?.date || ''

                return (
                  <motion.button
                    key={dayIndex}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: index * 0.008 }}
                    className="w-[10px] h-[10px] rounded-[2px] focus:outline-none focus:ring-2 focus:ring-primary"
                    style={{ backgroundColor: color }}
                    onClick={() => onDayClick?.(dateStr, day)}
                    aria-label={day ? `${day.date}: ${getSentimentLabel(day.score)}情绪, ${day.memory_count}条记忆` : `${dateStr}: 无数据`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function getSentimentLabel(score: number): string {
  if (score >= 8) return '非常积极'
  if (score >= 5) return '积极'
  if (score >= 2) return '轻微积极'
  if (score >= -1) return '中性'
  if (score >= -4) return '轻微消极'
  if (score >= -7) return '消极'
  return '非常消极'
}
