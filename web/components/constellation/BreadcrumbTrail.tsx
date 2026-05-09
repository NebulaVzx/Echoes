'use client'

import { ChevronRight, X } from 'lucide-react'

interface BreadcrumbItem {
  id: string
  label: string
}

interface BreadcrumbTrailProps {
  items: BreadcrumbItem[]
  onNavigate?: (index: number) => void
  onClear?: () => void
}

export function BreadcrumbTrail({ items, onNavigate, onClear }: BreadcrumbTrailProps) {
  if (items.length === 0) return null

  return (
    <div className="flex items-center gap-1 px-4 py-3 border-b overflow-x-auto scrollbar-none">
      <span className="text-xs text-muted-foreground whitespace-nowrap mr-1">探索路径:</span>
      {items.map((item, index) => (
        <div key={`${item.id}-${index}`} className="flex items-center gap-1 shrink-0">
          {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          <button
            onClick={() => onNavigate?.(index)}
            className={`text-xs truncate max-w-[100px] hover:underline ${
              index === items.length - 1
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground'
            }`}
            title={item.label}
          >
            {item.label.length > 15 ? item.label.slice(0, 15) + '...' : item.label}
          </button>
        </div>
      ))}
      {onClear && items.length > 1 && (
        <button
          onClick={onClear}
          className="ml-2 text-muted-foreground hover:text-destructive"
          title="重置探索路径"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
