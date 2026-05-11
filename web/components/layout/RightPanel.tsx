'use client'

import { usePathname } from 'next/navigation'
import { useLayout } from '@/app/providers/layout-provider'
import { RightPanelWidget } from '@/components/layout/RightPanelWidget'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'

// Empty state messages per page context
const EMPTY_STATES: Record<string, { heading: string; body: string }> = {
  '/constellation': { heading: '记忆星图即将生成', body: '保存更多记忆后，星图会自动展示它们之间的关联' },
  '/explore':       { heading: '选择一个页面',     body: '右侧面板会根据当前页面显示相关上下文和快捷操作' },
  '/mood':          { heading: '这里还没有内容',   body: '继续探索，相关内容会出现在这里' },
  '/daily-echo':    { heading: '这里还没有内容',   body: '继续探索，相关内容会出现在这里' },
  '/weave':         { heading: '选择一个页面',     body: '右侧面板会根据当前页面显示相关上下文和快捷操作' },
}

const DEFAULT_EMPTY = { heading: '选择一个页面', body: '右侧面板会根据当前页面显示相关上下文和快捷操作' }

export function RightPanel() {
  const { rightPanelVisible, rightPanelWidth, setRightPanelWidth } = useLayout()
  const pathname = usePathname()
  const emptyState = EMPTY_STATES[pathname] || DEFAULT_EMPTY

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = rightPanelWidth

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX
      const newWidth = Math.min(400, Math.max(200, startWidth + delta))
      setRightPanelWidth(newWidth)
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return (
    <aside
      className="right-panel flex flex-col h-full"
      style={{ width: rightPanelWidth }}
      data-visible={rightPanelVisible}
    >
      {/* Panel header with toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">上下文</span>
        <button
          onClick={() => {}} // Toggle handled by LayoutProvider
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="关闭面板"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      {/* Resize handle — left edge drag */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 transition-colors"
        onMouseDown={handleResizeStart}
      />

      {/* Panel content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <RightPanelWidget pathname={pathname} emptyHeading={emptyState.heading} emptyBody={emptyState.body} />
        </div>
      </ScrollArea>
    </aside>
  )
}
