'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/app/providers/theme-provider'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command'
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
  Settings,
  Sun,
  Moon,
  Search,
  Shuffle,
} from 'lucide-react'

interface CommandItem {
  id: string
  label: string
  icon: typeof Clock
  action: 'navigate' | 'toggle-theme' | 'random-explore'
  href?: string
  keywords: string[]
  group: string
}

const COMMANDS: CommandItem[] = [
  { id: 'timeline',    label: '时间轴',   icon: Clock,     action: 'navigate', href: '/',               keywords: ['首页', 'timeline', 'home'], group: '页面' },
  { id: 'star-graph',  label: '记忆星图', icon: Sparkles,  action: 'navigate', href: '/constellation',   keywords: ['星图', '图谱', 'constellation'], group: '页面' },
  { id: 'explore',     label: '探索模式', icon: Compass,   action: 'navigate', href: '/explore',         keywords: ['探索', '发现', 'explore'], group: '页面' },
  { id: 'tags',        label: '标签云',   icon: Tag,       action: 'navigate', href: '/tags',            keywords: ['标签', 'tags'], group: '页面' },
  { id: 'mood',        label: '情绪日历', icon: Smile,     action: 'navigate', href: '/mood',            keywords: ['情绪', '日历', 'mood'], group: '页面' },
  { id: 'daily-echo',  label: '每日回响', icon: Bell,      action: 'navigate', href: '/daily-echo',      keywords: ['回响', '每日', 'daily'], group: '页面' },
  { id: 'weave',       label: '记忆编织', icon: PenLine,   action: 'navigate', href: '/weave',           keywords: ['编织', 'weave'], group: '页面' },
  { id: 'capsules',    label: '时间胶囊', icon: Package2,  action: 'navigate', href: '/capsules',        keywords: ['胶囊', 'capsules'], group: '页面' },
  { id: 'profile',     label: '个人画像', icon: User,      action: 'navigate', href: '/profile',         keywords: ['画像', 'profile'], group: '页面' },
  { id: 'settings',    label: '设置',     icon: Settings,  action: 'navigate', href: '/settings',        keywords: ['设置', 'settings'], group: '页面' },
  { id: 'theme',       label: '切换主题', icon: Sun,       action: 'toggle-theme', keywords: ['主题', '暗黑', 'theme', 'dark'], group: '命令' },
  { id: 'random',      label: '随机探索', icon: Shuffle,   action: 'random-explore', keywords: ['随机', '探索', 'random'], group: '命令' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()
  const { resolvedTheme, toggleTheme } = useTheme()

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = useCallback((item: CommandItem) => {
    setOpen(false)
    switch (item.action) {
      case 'navigate':
        if (item.href) router.push(item.href)
        break
      case 'toggle-theme':
        toggleTheme()
        break
      case 'random-explore':
        router.push('/explore')
        break
    }
  }, [router, toggleTheme])

  // Filtering with "/" prefix (filter by tag) and ">" prefix (commands only)
  const isSlashMode = query.startsWith('/')
  const isCommandMode = query.startsWith('>')

  const filteredCommands = query
    ? COMMANDS.filter((item) => {
        // Filter mode logic
        if (isCommandMode) return item.group === '命令'
        if (isSlashMode) return item.group === '页面'  // tag filter is future; for now just pages

        const searchTerm = query.toLowerCase()
        return (
          item.label.toLowerCase().includes(searchTerm) ||
          item.keywords.some((k) => k.includes(searchTerm))
        )
      })
    : COMMANDS

  const groupedCommands = filteredCommands.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {} as Record<string, CommandItem[]>)

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={open ? '搜索记忆或输入命令...' : 'Cmd+K 打开命令面板'}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          <div className="py-6 text-center text-sm">
            <p className="text-muted-foreground">没有找到匹配项</p>
            <p className="text-xs text-muted-foreground/60 mt-1">尝试其他关键词或标签</p>
          </div>
        </CommandEmpty>

        {Object.entries(groupedCommands).map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((item) => {
              const ThemeIcon = resolvedTheme === 'dark' && item.id === 'theme' ? Sun : item.icon
              return (
                <CommandItem
                  key={item.id}
                  onSelect={() => runCommand(item)}
                  value={item.id + ' ' + item.label + ' ' + item.keywords.join(' ')}
                >
                  <ThemeIcon className="mr-2 h-4 w-4" />
                  {item.label}
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>

      {/* Hint footer */}
      <div className="px-3 py-2 border-t border-border">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
          <span>输入 <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">/</kbd> 按标签筛选</span>
          <span>输入 <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">&gt;</kbd> 执行命令</span>
        </div>
      </div>
    </CommandDialog>
  )
}
