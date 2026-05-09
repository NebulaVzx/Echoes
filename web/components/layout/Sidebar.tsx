'use client'

import { useLayout } from '@/app/providers/layout-provider'
import { SidebarItem } from '@/components/layout/SidebarItem'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Clock,
  Sparkles,
  Compass,
  Tag,
  Smile,
  Bell,
  PenLine,
  Package2,
  User,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Navigation categories with items — exact labels from CONTEXT.md section 3
const NAV_SECTIONS: {
  id: string
  label: string
  items: { href: string; label: string; icon: typeof Clock; isNew: boolean; exact?: boolean }[]
}[] = [
  {
    id: 'echoes',
    label: '拾忆',
    items: [
      { href: '/',                     label: '时间轴',   icon: Clock,     isNew: false, exact: true },
      { href: '/constellation',        label: '记忆星图', icon: Sparkles,  isNew: false },
      { href: '/explore',              label: '探索模式', icon: Compass,   isNew: false },
    ],
  },
  {
    id: 'discover',
    label: '发现',
    items: [
      { href: '/tags',                 label: '标签云',   icon: Tag,       isNew: false },
      { href: '/mood',                 label: '情绪日历', icon: Smile,     isNew: true },
      { href: '/daily-echo',           label: '每日回响', icon: Bell,      isNew: true },
    ],
  },
  {
    id: 'create',
    label: '创作',
    items: [
      { href: '/weave',                label: '记忆编织', icon: PenLine,   isNew: true },
      { href: '/capsules',             label: '时间胶囊', icon: Package2,  isNew: false },
    ],
  },
  {
    id: 'profile',
    label: '我的',
    items: [
      { href: '/profile',              label: '个人画像', icon: User,      isNew: true },
    ],
  },
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useLayout()

  return (
    <nav className="flex flex-col h-full w-full bg-sidebar/50 border-r border-border">
      {/* Collapse toggle — TOP, always visible */}
      <div className={cn(
        'flex items-center border-b border-border',
        sidebarCollapsed ? 'justify-center py-3' : 'justify-between px-3 py-2.5'
      )}>
        {!sidebarCollapsed && (
          <span className="text-xs font-medium text-muted-foreground truncate">
            导航
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className={cn(
            'flex items-center justify-center rounded-md text-muted-foreground',
            'hover:bg-muted hover:text-foreground transition-colors',
            'focus-visible:outline-none',
            sidebarCollapsed ? 'h-8 w-8' : 'h-7 px-2 gap-1.5'
          )}
          aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-3.5 w-3.5" />
              <span className="text-xs">收起</span>
            </>
          )}
        </button>
      </div>

      {/* Nav items — scrollable */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 px-2 py-2">
          {NAV_SECTIONS.map((section, sectionIdx) => (
            <div key={section.id}>
              {/* Section label (hidden when collapsed) */}
              {!sidebarCollapsed && (
                <div className="px-3 pt-3 pb-1.5 text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                  {section.label}
                </div>
              )}
              {section.items.map((item) => (
                <SidebarItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  collapsed={sidebarCollapsed}
                  isNew={item.isNew}
                  exact={item.exact}
                />
              ))}
              {/* Separator between sections (except last) */}
              {sectionIdx < NAV_SECTIONS.length - 1 && !sidebarCollapsed && (
                <Separator className="my-2 mx-3 w-auto" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </nav>
  )
}
