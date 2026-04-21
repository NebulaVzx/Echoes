import { test, expect } from '@playwright/test'

test.describe('Search', () => {
  test('search for memories', async ({ page }) => {
    // First create a memory with searchable content
    await page.goto('/')
    const content = `Unique search term ${Date.now()}`
    const textarea = page.getByPlaceholder('记下你的想法...')
    await textarea.fill(content)
    await page.getByRole('button', { name: '保存记忆' }).click()
    await expect(page.getByText('记忆已保存')).toBeVisible({ timeout: 5000 })

    // Search for the memory using the search input
    const searchInput = page.getByPlaceholder('搜索你的记忆...')
    await searchInput.fill(content)
    await page.keyboard.press('Enter')

    // Wait for search results page
    await page.waitForURL(/\/search\?/)

    // Verify the memory appears in search results
    await expect(page.getByText(content)).toBeVisible({ timeout: 10000 })
  })

  test('empty search shows no results message', async ({ page }) => {
    await page.goto('/search?q=nonexistent_xyz_12345')

    // Should show empty state message
    await expect(page.getByText(/没有找到|换个关键词/i)).toBeVisible()
  })
})
