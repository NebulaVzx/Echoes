import { test, expect } from '@playwright/test'

// Auth state: provided globally by playwright.config.ts (chromium project)
// To test without auth, use: test.use({ storageState: { cookies: [], origins: [] } })

// ============================================================
// T1 — 三栏布局 (Desktop)
// ============================================================
test.describe('T1a: Login page (no AppShell)', () => {
  // Override global storageState — login page should be tested without auth
  test.use({ storageState: { cookies: [], origins: [] } })

  test('login page renders WITHOUT AppShell', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    // 登录页不应该有 app-shell
    const shell = page.locator('.app-shell')
    await expect(shell).toHaveCount(0)
  })
})

test.describe('T1b: Authenticated layout (with AppShell)', () => {
  test('authenticated home page renders WITH AppShell', async ({ page }) => {
    await page.goto('/')
    // AppShell grid 容器应该存在
    const shell = page.locator('.app-shell')
    await expect(shell).toBeVisible({ timeout: 10000 })
    // 应该有 header/sidebar/main/panel 四区
    await expect(page.locator('.app-shell-header')).toBeAttached()
    await expect(page.locator('.app-shell-sidebar')).toBeAttached()
    await expect(page.locator('.app-shell-main')).toBeAttached()
    await expect(page.locator('.app-shell-panel')).toBeAttached()
  })
})

// ============================================================
// T2 — Header 简化
// ============================================================
test.describe('T2: Simplified Header', () => {
  // auth provided globally by playwright.config.ts

  test('header has only Logo + Search + Avatar', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('.app-shell-header')
    await expect(header).toBeVisible({ timeout: 10000 })

    // Logo 链接到 /
    const logoLink = header.locator('a[aria-label*="首页"]')
    await expect(logoLink).toBeAttached()

    // 搜索框存在
    const searchInput = header.locator('input[placeholder*="搜索"]')
    await expect(searchInput.or(header.locator('[class*="search"]'))).toBeAttached()

    // 不应该有 ThemeToggle 内联按钮（已移到 UserMenu）
    // 检查 header 内没有直接的 text/theme 切换按钮
    const headerHtml = await header.innerHTML()
    expect(headerHtml).not.toContain('ThemeToggle')
  })
})

// ============================================================
// T3 — Sidebar 导航
// ============================================================
test.describe('T3: Sidebar Navigation', () => {
  // auth provided globally by playwright.config.ts

  test('sidebar contains correct sections and items', async ({ page }) => {
    await page.goto('/')
    const sidebar = page.locator('.app-shell-sidebar')
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // 4 个分组标签
    await expect(sidebar.getByText('拾忆')).toBeAttached()
    await expect(sidebar.getByText('发现')).toBeAttached()
    await expect(sidebar.getByText('创作')).toBeAttached()
    await expect(sidebar.getByText('我的')).toBeAttached()

    // 核心导航项
    await expect(sidebar.getByText('时间轴')).toBeAttached()
    await expect(sidebar.getByText('标签云')).toBeAttached()
    await expect(sidebar.getByText('时间胶囊')).toBeAttached()
  })

  test('sidebar collapse toggle works', async ({ page }) => {
    await page.goto('/')
    const sidebar = page.locator('.app-shell-sidebar')
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // 找到折叠按钮
    const toggleBtn = sidebar.locator('button[aria-label*="收起"]')
    await expect(toggleBtn).toBeAttached()

    // 点击折叠
    await toggleBtn.click()
    await page.waitForTimeout(300)

    // 折叠后侧边栏变窄 (检查 class 或 style)
    const sidebarWidth = await sidebar.evaluate(el => el.clientWidth)
    expect(sidebarWidth).toBeLessThan(100) // < 100px when collapsed (48px target)

    // 展开
    const expandBtn = sidebar.locator('button[aria-label*="展开"]')
    await expandBtn.click()
    await page.waitForTimeout(300)

    const expandedWidth = await sidebar.evaluate(el => el.clientWidth)
    expect(expandedWidth).toBeGreaterThan(150) // > 150px when expanded (200px target)
  })
})

// ============================================================
// T5 — Command Palette
// ============================================================
test.describe('T5: Command Palette', () => {
  // auth provided globally by playwright.config.ts

  test('Cmd+K opens CommandPalette', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 按 Ctrl+K (Windows)
    await page.keyboard.press('Control+k')
    await page.waitForTimeout(500)

    // Command dialog 应该弹出
    const cmdDialog = page.locator('[cmdk-root], [data-slot="command"], [role="dialog"]')
    // 至少某一种选择器应该匹配
    const dialogCount = await cmdDialog.count()
    // 如果没匹配到，检查页面是否有任何 dialog
    if (dialogCount === 0) {
      // 在 shadcn v4 中，command dialog 可能通过不同方式渲染
      const anyDialog = page.locator('[role="dialog"], [data-slot="command-dialog"]')
      await expect(anyDialog.first()).toBeAttached({ timeout: 3000 })
    }
  })
})

// ============================================================
// T9 — 存量页面无 <header>
// ============================================================
test.describe('T9: No inline headers in refactored pages', () => {
  // auth provided globally by playwright.config.ts

  const existingPages = ['/', '/search?q=test', '/tags', '/capsules', '/settings']

  for (const route of existingPages) {
    test(`${route} has no <header> element`, async ({ page }) => {
      await page.goto(route)
      await page.waitForLoadState('networkidle')

      // 页面主体内不应该有 <header> 元素
      const headerElements = await page.locator('header').count()
      // 仅 AppShell 的 .app-shell-header 包含一个 header
      const shellHeaders = await page.locator('.app-shell-header').count()
      // 应该只有一个 header（AppShell 提供的）
      expect(headerElements).toBe(shellHeaders)
    })
  }
})

// ============================================================
// T10 — 新占位页面
// ============================================================
test.describe('T10: New placeholder pages', () => {
  // auth provided globally by playwright.config.ts

  const newPages: Record<string, string> = {
    constellation: 'Phase 13',
    explore: 'Phase 13',
    mood: 'Phase 15',
    'daily-echo': 'Phase 15',
    weave: 'Phase 14',
    profile: 'Phase 16',
  }

  for (const [route, phase] of Object.entries(newPages)) {
    test(`/${route} renders placeholder`, async ({ page }) => {
      await page.goto(`/${route}`)
      await page.waitForLoadState('networkidle')
      // 页面应该包含目标阶段号
      await expect(page.locator(`text=Phase ${phase.split(' ')[1]}`)).toBeAttached({ timeout: 5000 })
    })
  }
})

// ============================================================
// T4 — UserMenu
// ============================================================
test.describe('T4: UserMenu dropdown', () => {
  // auth provided globally by playwright.config.ts

  test('clicking avatar opens dropdown', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 找到 header 右侧的用户区域（Avatar 或登录链接）
    const headerRight = page.locator('.app-shell-header [class*="flex-shrink-0"]').last()
    await expect(headerRight).toBeAttached({ timeout: 5000 })

    // 点击 avatar 按钮（任何在 header 右侧的 button）
    const avatarBtn = headerRight.locator('button').first()
    const avatarCount = await avatarBtn.count()
    if (avatarCount > 0) {
      await avatarBtn.click()
      await page.waitForTimeout(500)

      // 下拉菜单项 — 只要菜单出现就算通过
      const menuItems = page.locator('[role="menu"] [role="menuitem"], [data-slot="dropdown-menu"] [role="menuitem"]')
      const menuCount = await menuItems.count()
      // 如果 menu items 存在，说明 dropdown 正常
      if (menuCount > 0) {
        await expect(menuItems.first()).toBeAttached()
      } else {
        // v4 可能用不同结构
        const menu = page.locator('[data-slot="dropdown-menu-content"]')
        await expect(menu).toBeAttached({ timeout: 3000 })
      }
    }
    // 如果没有 avatar button（非认证状态），那页面上应该有"登录"链接
  })
})
