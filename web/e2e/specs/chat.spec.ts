import { test, expect } from '@playwright/test'

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('open chat sidebar and send a message', async ({ page }) => {
    // Click AI assistant button in header
    const chatButton = page.getByRole('button', { name: 'AI 助手' })
    await expect(chatButton).toBeVisible()
    await chatButton.click()

    // Sidebar should open
    const sidebar = page.locator('[data-testid="chat-sidebar"]')
    await expect(sidebar).toBeVisible()

    // Type and send a message
    const input = page.getByPlaceholder('问点什么...')
    await input.fill('你好')
    await page.keyboard.press('Enter')

    // User message should appear immediately
    await expect(page.getByText('你好')).toBeVisible()

    // Typing indicator should appear while waiting for response
    await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible()
  })

  test('create and delete a conversation', async ({ page }) => {
    // Open sidebar
    await page.getByRole('button', { name: 'AI 助手' }).click()

    // Click new conversation button
    await page.getByRole('button', { name: '新对话' }).click()

    // Send a message to create a conversation
    const input = page.getByPlaceholder('问点什么...')
    await input.fill('Test conversation')
    await page.keyboard.press('Enter')

    // Wait for conversation to appear in history
    await expect(page.getByText('Test conversation')).toBeVisible()

    // Open history panel
    await page.getByRole('button', { name: '历史对话' }).click()

    // Delete the first conversation
    const deleteButton = page.locator('button[title="删除对话"]').first()
    await deleteButton.click()

    // Conversation should be removed
    await expect(page.getByText('Test conversation')).not.toBeVisible()
  })

  test('chat sidebar supports dark mode', async ({ page }) => {
    // Toggle dark mode
    await page.getByRole('button', { name: '切换到暗黑模式' }).click()

    // Open sidebar
    await page.getByRole('button', { name: 'AI 助手' }).click()

    // Sidebar should have dark mode class
    const sidebar = page.locator('[data-testid="chat-sidebar"]')
    await expect(sidebar).toHaveClass(/dark/)
  })

  test('empty state shows placeholder text', async ({ page }) => {
    // Open sidebar
    await page.getByRole('button', { name: 'AI 助手' }).click()

    // Start a new conversation to clear any previous messages
    await page.getByRole('button', { name: '新对话' }).click()

    // Empty state placeholder should be visible
    await expect(page.getByText('开始一段新对话吧')).toBeVisible()
  })

  test('close sidebar via header button', async ({ page }) => {
    // Open sidebar
    await page.getByRole('button', { name: 'AI 助手' }).click()

    const sidebar = page.locator('[data-testid="chat-sidebar"]')
    await expect(sidebar).toBeVisible()

    // Close via header close button
    await page.getByRole('button', { name: '关闭' }).click()

    // Sidebar should be removed from DOM
    await expect(sidebar).not.toBeVisible()
  })

  test('conversation history panel toggles', async ({ page }) => {
    // Open sidebar
    await page.getByRole('button', { name: 'AI 助手' }).click()

    // Send a message to create a conversation
    const input = page.getByPlaceholder('问点什么...')
    await input.fill('History test message')
    await page.keyboard.press('Enter')

    // Wait for the message to appear
    await expect(page.getByText('History test message')).toBeVisible()

    // Open history panel
    await page.getByRole('button', { name: '历史对话' }).click()

    // History panel should show the conversation
    await expect(page.getByText('History test message')).toBeVisible()

    // Go back to chat view by clicking a conversation
    await page.getByText('History test message').click()

    // Chat input should be visible again
    await expect(page.getByPlaceholder('问点什么...')).toBeVisible()
  })

  test('send multiple messages in same conversation', async ({ page }) => {
    // Open sidebar
    await page.getByRole('button', { name: 'AI 助手' }).click()

    // Send first message
    const input = page.getByPlaceholder('问点什么...')
    await input.fill('Message one')
    await page.keyboard.press('Enter')
    await expect(page.getByText('Message one')).toBeVisible()

    // Wait for typing indicator to appear then disappear (response completes)
    await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid="typing-indicator"]')).not.toBeVisible({ timeout: 30_000 })

    // Send second message
    await input.fill('Message two')
    await page.keyboard.press('Enter')

    // Second user message should appear
    await expect(page.getByText('Message two')).toBeVisible()
  })
})
