import { test, expect } from '@playwright/test'

test.describe('Settings and Theme', () => {
  test('settings page loads with all sections', async ({ page }) => {
    await page.goto('/')

    // Navigate to settings via header link
    await page.getByRole('link', { name: '设置' }).click()
    await page.waitForURL('/settings')

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

    // Get the theme toggle button by aria-label
    const themeToggle = page.getByRole('button', {
      name: /切换到亮色模式|切换到暗黑模式/,
    })
    await expect(themeToggle).toBeVisible()

    // Check initial html class (should have either light or dark)
    const html = page.locator('html')
    const initialClass = await html.getAttribute('class')
    const initiallyDark = initialClass?.includes('dark') ?? false

    // Toggle theme
    await themeToggle.click()

    // Verify theme changed
    if (initiallyDark) {
      await expect(html).toHaveClass(/light/)
    } else {
      await expect(html).toHaveClass(/dark/)
    }

    // Toggle back
    await themeToggle.click()

    // Verify theme restored
    if (initiallyDark) {
      await expect(html).toHaveClass(/dark/)
    } else {
      await expect(html).toHaveClass(/light/)
    }
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
