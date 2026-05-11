'use client'

import { useThemeColor } from '@/app/providers/theme-color-provider'

type AccentPreset = 'neutral' | 'blue' | 'green' | 'orange' | 'violet'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const PRESETS: { key: AccentPreset; label: string; color: string }[] = [
  { key: 'neutral', label: '石墨灰', color: '#1A1A1A' },
  { key: 'blue',    label: '深海蓝', color: '#3B82F6' },
  { key: 'green',   label: '森林绿', color: '#10B981' },
  { key: 'orange',  label: '珊瑚橙', color: '#F97316' },
  { key: 'violet',  label: '紫罗兰', color: '#8B5CF6' },
]

export function ThemeColorPicker() {
  const { accent, setAccent } = useThemeColor()

  return (
    <div className="flex flex-wrap gap-3">
      {PRESETS.map((preset) => {
        const isActive = accent === preset.key
        return (
          <button
            key={preset.key}
            onClick={() => setAccent(preset.key)}
            className={cn(
              'flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all',
              isActive
                ? 'border-primary bg-primary/5'
                : 'border-transparent hover:border-border hover:bg-muted'
            )}
            aria-label={`主题色: ${preset.label}`}
          >
            <span
              className="block w-8 h-8 rounded-full ring-1 ring-border/50 relative"
              style={{ backgroundColor: preset.color }}
            >
              {isActive && (
                <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-sm" />
              )}
            </span>
            <span className="text-[11px] text-muted-foreground">{preset.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// Re-export AccentPreset type for convenience
export type { AccentPreset }
