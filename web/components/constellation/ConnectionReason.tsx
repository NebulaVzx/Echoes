'use client'

import { Sparkles } from 'lucide-react'

interface ConnectionReasonProps {
  reason: string
  loading?: boolean
}

export function ConnectionReason({ reason, loading }: ConnectionReasonProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Sparkles className="h-3 w-3 animate-pulse" />
        <span className="text-xs italic">正在思考它们之间的联系...</span>
      </div>
    )
  }

  return (
    <p className="text-[13px] italic text-muted-foreground leading-relaxed">
      {reason || '这两段记忆在语义上有关联'}
    </p>
  )
}
