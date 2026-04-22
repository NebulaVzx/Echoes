import { test, expect } from '@playwright/test'

test.describe('Memory Management', () => {
  test('create text memory', async ({ page }) => {
    await page.goto('/')

    // Ensure we're on the home page
    await expect(page.getByText('时间轴')).toBeVisible()

    // Fill create form with unique content
    const content = `E2E test memory ${Date.now()}`
    const textarea = page.getByPlaceholder('记下你的想法...')
    await expect(textarea).toBeVisible()
    await textarea.fill(content)

    // Submit form
    await page.getByRole('button', { name: '保存记忆' }).click()

    // Wait for success toast
    await expect(page.getByText('记忆已保存')).toBeVisible({ timeout: 5000 })

    // Verify memory appears in list
    await expect(page.getByText(content)).toBeVisible({ timeout: 10000 })
  })

  test('view memory detail', async ({ page }) => {
    // First create a memory to view
    await page.goto('/')
    const content = `View detail test ${Date.now()}`
    const textarea = page.getByPlaceholder('记下你的想法...')
    await textarea.fill(content)
    await page.getByRole('button', { name: '保存记忆' }).click()
    await expect(page.getByText('记忆已保存')).toBeVisible({ timeout: 5000 })

    // Click on the memory card to view detail
    await page.getByText(content).click()

    // Wait for detail page
    await page.waitForURL(/\/memory\//)

    // Verify detail page has expected elements
    await expect(page.getByText('返回')).toBeVisible()
    await expect(page.getByText('删除')).toBeVisible()
  })

  test('delete memory', async ({ page }) => {
    // First create a memory to delete
    await page.goto('/')
    const content = `Delete test ${Date.now()}`
    const textarea = page.getByPlaceholder('记下你的想法...')
    await textarea.fill(content)
    await page.getByRole('button', { name: '保存记忆' }).click()
    await expect(page.getByText('记忆已保存')).toBeVisible({ timeout: 5000 })

    // Navigate to detail page
    await page.getByText(content).click()
    await page.waitForURL(/\/memory\//)

    // Handle confirmation dialog
    page.on('dialog', dialog => dialog.accept())

    // Click delete
    await page.getByText('删除').click()

    // Should redirect back to home
    await page.waitForURL('/')
    await expect(page.getByText('时间轴')).toBeVisible()
  })
})
