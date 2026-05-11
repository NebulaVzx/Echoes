'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Clock, Sparkles, Package2, Tag, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const DOCK_ITEMS = [
  { href: '/',              label: '拾', icon: Clock },
  { href: '/constellation', label: '星', icon: Sparkles },
  { href: '/capsules',      label: '胶', icon: Package2 },
  { href: '/tags',          label: '标', icon: Tag },
  { href: '/profile',       label: '我', icon: User },
]

export function MobileDock() {
  const pathname = usePathname()

  return (
    <nav className="mobile-dock flex items-center justify-around md:hidden">
      {DOCK_ITEMS.map((item) => {
        const isActive = item.href === '/'
          ? pathname === '/'
          : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-0.5 px-2 py-1 min-w-0 text-xs transition-colors',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
              'focus-visible:outline-none'
            )}
          >
            <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
            <span className="text-[10px] leading-tight">{item.label}</span>
            {isActive && (
              <span className="absolute bottom-0 w-1 h-1 bg-primary rounded-full" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
