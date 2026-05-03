'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type LucideIcon } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface SidebarItemProps {
  href: string
  label: string
  icon: LucideIcon
  collapsed?: boolean
  isNew?: boolean
  /** Exact route match (default: checks if pathname starts with href) */
  exact?: boolean
}

export function SidebarItem({ href, label, icon: Icon, collapsed = false, isNew = false, exact = false }: SidebarItemProps) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname.startsWith(href)

  const linkContent = (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
        'hover:bg-muted hover:text-foreground',
        isActive && 'bg-primary/10 text-primary font-medium',
        collapsed ? 'justify-center px-0 w-12 h-10 mx-auto' : 'w-full'
      )}
    >
      <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
      {!collapsed && (
        <span className="flex-1 truncate">{label}</span>
      )}
      {!collapsed && isNew && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-600 dark:text-amber-400">
          ✨
        </Badge>
      )}
      {/* Left accent bar for active state */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
      )}
    </Link>
  )

  // When collapsed, wrap in tooltip
  if (collapsed) {
    return (
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div className="relative">{linkContent}</div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {label}
          {isNew && <span className="ml-1 text-amber-500">✨</span>}
        </TooltipContent>
      </Tooltip>
    )
  }

  return <div className="relative">{linkContent}</div>
}
