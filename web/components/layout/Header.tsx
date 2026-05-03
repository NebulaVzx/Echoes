'use client'

import Logo from '@/components/logo'
import SearchInput from '@/components/search/search-input'
import { UserMenu } from '@/components/layout/UserMenu'
import { useAuth } from '@/app/providers/auth-provider'
import Link from 'next/link'

export function Header() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="flex items-center justify-between h-12 px-4 border-b border-border bg-background">
      {/* Left: Logo + Brand */}
      <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group" aria-label="拾忆 - 首页">
        <div className="flex items-center gap-2">
          <Logo size={28} className="text-foreground" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              Echoes
            </span>
            <span className="text-[10px] text-muted-foreground">
              拾忆
            </span>
          </div>
        </div>
      </Link>

      {/* Center: Global Search — grows to fill space */}
      <div className="flex-1 max-w-xl mx-4">
        <SearchInput />
      </div>

      {/* Right: User Avatar (only when authenticated) */}
      <div className="flex-shrink-0">
        {isAuthenticated ? (
          <UserMenu />
        ) : (
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            登录
          </Link>
        )}
      </div>
    </div>
  )
}
