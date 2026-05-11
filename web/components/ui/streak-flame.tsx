'use client'

import { Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StreakFlameProps {
  streak: number
  className?: string
}

export function StreakFlame({ streak, className }: StreakFlameProps) {
  if (streak < 3) return null

  const intensity = Math.min(streak, 30)
  const scale = 1 + Math.min(intensity / 30, 0.3)

  return (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      title={`连续 ${streak} 天记录`}
    >
      <span
        className="inline-block animate-pulse"
        style={{
          transform: `scale(${scale})`,
          filter: `drop-shadow(0 0 ${Math.min(intensity, 10)}px rgba(245, 158, 11, 0.6))`,
        }}
      >
        <Flame
          className={cn(
            'h-4 w-4',
            intensity >= 20 ? 'text-orange-500' : intensity >= 10 ? 'text-orange-400' : 'text-amber-500'
          )}
          fill="currentColor"
        />
      </span>
      <span className="text-xs font-medium text-muted-foreground">{streak}</span>
    </span>
  )
}
