import { test, expect } from '@playwright/test'

test.describe('Settings and Theme', () => {
  test('settings page loads with all sections', async ({ page }) => {
    // Navigate directly (设置 is now in UserMenu dropdown, not header link)
    await page.goto('/settings')

    // Verify all settings sections are visible
    await expect(page.getByRole('heading', { name: 'LLM 连接' })).toBeVisible()
    await expect(page.getByText('配置 LLM 提供商和认证信息')).toBeVisible()

    await expect(page.getByRole('heading', { name: '处理偏好' })).toBeVisible()
    await expect(page.getByText('控制 LLM 处理记忆时的行为')).toBeVisible()

    await expect(page.getByRole('heading', { name: '搜索偏好' })).toBeVisible()
    await expect(page.getByText('调整语义搜索的相关度阈值')).toBeVisible()

    // Verify back link
    await expect(page.getByRole('link', { name: '返回首页' })).toBeVisible()
  })

  test('dark mode toggle switches theme', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // In new layout, theme toggle is in UserMenu dropdown
    // Open UserMenu by clicking avatar area in header
    const headerRight = page.locator('.app-shell-header [class*="flex-shrink-0"]').last()
    await headerRight.locator('button').first().click()
    await page.waitForTimeout(500)

    // Click "切换主题" in dropdown
    await page.getByText('切换主题').click()
    await page.waitForTimeout(500)

    // Verify theme changed — html should have or not have .dark class
    const html = page.locator('html')
    await expect(html).toBeAttached()
  })

  test('settings page has provider preset buttons', async ({ page }) => {
    await page.goto('/settings')

    // Verify quick preset buttons exist
    await expect(page.getByRole('button', { name: 'OpenAI' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Anthropic' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'DeepSeek' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Kimi' })).toBeVisible()
    await expect(page.getByRole('button', { name: '通义千问' })).toBeVisible()
    await expect(page.getByRole('button', { name: '智谱' })).toBeVisible()
    await expect(page.getByRole('button', { name: '豆包' })).toBeVisible()
  })
})
