'use client'

interface RightPanelWidgetProps {
  pathname: string
  emptyHeading: string
  emptyBody: string
}

export function RightPanelWidget({ pathname, emptyHeading, emptyBody }: RightPanelWidgetProps) {
  // Phase 11: infrastructure only — empty states for all pages.
  // Per-page widgets (那年今日, 相似记忆推荐, etc.) deferred to Phases 13-16.
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </div>
      <h3 className="text-sm font-medium text-muted-foreground mb-1">{emptyHeading}</h3>
      <p className="text-xs text-muted-foreground/60 max-w-[200px]">{emptyBody}</p>
    </div>
  )
}
