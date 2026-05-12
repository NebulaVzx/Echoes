'use client'

import { MoodDayData } from '@/lib/api'
import { getSentimentLabel } from '@/lib/mood-colors'

interface MoodDayTooltipProps {
  date: string
  data: MoodDayData | null
}

export default function MoodDayTooltip({ date, data }: MoodDayTooltipProps) {
  if (!data) {
    return (
      <div className="p-3">
        <p className="text-sm text-muted-foreground">这一天没有记忆</p>
      </div>
    )
  }

  const dateObj = new Date(date)
  const dateStr = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`

  return (
    <div className="p-3 space-y-1">
      <p className="text-sm font-semibold">{dateStr}</p>
      <p className="text-xs">
        情绪倾向：{getSentimentLabel(data.score)} ({data.score > 0 ? '+' : ''}{data.score})
      </p>
      <p className="text-xs text-muted-foreground">{data.memory_count} 条记忆</p>
    </div>
  )
}
