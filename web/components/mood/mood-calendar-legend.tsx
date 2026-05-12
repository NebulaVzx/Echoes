'use client'

import { MOOD_COLORS } from '@/lib/mood-colors'

export default function MoodCalendarLegend() {
  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  const palette = isDark ? MOOD_COLORS.dark : MOOD_COLORS.light

  const items = [
    { color: palette.stronglyNegative, label: '消极' },
    { color: palette.negative, label: '' },
    { color: palette.mildlyNegative, label: '' },
    { color: palette.neutral, label: '中性' },
    { color: palette.mildlyPositive, label: '' },
    { color: palette.positive, label: '' },
    { color: palette.stronglyPositive, label: '积极' },
  ]

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>消极</span>
      <div className="flex gap-1">
        {items.map((item, i) => (
          <div
            key={i}
            className="w-[10px] h-[10px] rounded-[2px]"
            style={{ backgroundColor: item.color }}
            title={item.label || undefined}
          />
        ))}
      </div>
      <span>积极</span>
    </div>
  )
}
