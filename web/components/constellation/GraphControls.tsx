'use client'

import { ZoomIn, ZoomOut, RotateCcw, Search, Grid3X3 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface GraphControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onFilter?: (query: string) => void
  onToggleDensity?: () => void
  filterValue?: string
}

export function GraphControls({
  onZoomIn,
  onZoomOut,
  onReset,
  onFilter,
  onToggleDensity,
  filterValue = '',
}: GraphControlsProps) {
  return (
    <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 bg-card/80 backdrop-blur-sm rounded-lg px-2 py-1.5 shadow-sm border">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onZoomIn}
          title="放大"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onZoomOut}
          title="缩小"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onReset}
          title="重置视图"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        {onToggleDensity && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleDensity}
            title="切换密度"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
        )}
      </div>
      {onFilter && (
        <div className="bg-card/80 backdrop-blur-sm rounded-lg px-2 py-1.5 shadow-sm border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="搜索记忆..."
              value={filterValue}
              onChange={(e) => onFilter(e.target.value)}
              className="h-8 w-48 pl-7 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}
