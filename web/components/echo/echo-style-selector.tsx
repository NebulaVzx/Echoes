'use client'

import { Heart, Laugh, Lightbulb, Feather } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EchoStyleOption {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const options: EchoStyleOption[] = [
  { value: 'warm', label: '温暖安慰', icon: Heart },
  { value: 'humorous', label: '幽默调侃', icon: Laugh },
  { value: 'concise', label: '简洁洞察', icon: Lightbulb },
  { value: 'poetic', label: '诗意文艺', icon: Feather },
]

interface EchoStyleSelectorProps {
  value: string
  onChange: (value: string) => void
}

export default function EchoStyleSelector({ value, onChange }: EchoStyleSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="回响风格">
      {options.map((option) => {
        const Icon = option.icon
        const isSelected = value === option.value
        return (
          <Button
            key={option.value}
            variant={isSelected ? 'secondary' : 'ghost'}
            size="sm"
            className={`text-xs gap-1 ${isSelected ? 'border-l-2 border-primary' : 'text-muted-foreground'}`}
            onClick={() => onChange(option.value)}
            role="radio"
            aria-checked={isSelected}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{option.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
