'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/providers/auth-provider'
import { useTheme } from '@/app/providers/theme-provider'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { User, Settings, Sun, Moon, LogOut } from 'lucide-react'

export function UserMenu() {
  const { user, logout } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()
  const router = useRouter()
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const userInitial = user?.username?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'
  const isDark = resolvedTheme === 'dark'

  const handleLogout = () => {
    setMenuOpen(false)
    setShowLogoutDialog(true)
  }

  const confirmLogout = () => {
    setShowLogoutDialog(false)
    logout()
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger>
          <button
            className="flex items-center gap-2 rounded-full hover:bg-muted transition-all duration-200 ease-out p-1 hover:scale-105 active:scale-95"
            aria-label="用户菜单"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                {userInitial}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => { setMenuOpen(false); router.push('/profile') }}>
            <User className="mr-2 h-4 w-4" />
            我的画像
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setMenuOpen(false); router.push('/settings') }}>
            <Settings className="mr-2 h-4 w-4" />
            设置
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setMenuOpen(false); toggleTheme() }}>
            {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            切换主题
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>退出登录</DialogTitle>
            <DialogDescription>
              退出后需要重新登录才能访问你的记忆，确定要继续吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmLogout}>
              确定退出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
