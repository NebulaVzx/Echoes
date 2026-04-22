import { test, expect } from '@playwright/test'

test.describe('Chat', () => {
  test('open chat sidebar and send a message', async ({ page }) => {
    await page.goto('/')

    // Click AI assistant button in header
    const chatButton = page.getByRole('button', { name: 'AI 助手' })
    await expect(chatButton).toBeVisible()
    await chatButton.click()

    // Sidebar should open
    const sidebar = page.locator('[data-testid="chat-sidebar"]')
    await expect(sidebar).toBeVisible()

    // Type and send a message
    const input = page.getByPlaceholder('向拾忆提问...')
    await input.fill('你好')
    await page.keyboard.press('Enter')

    // User message should appear immediately
    await expect(page.getByText('你好')).toBeVisible()

    // Typing indicator should appear
    await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible()
  })

  test('create and delete a conversation', async ({ page }) => {
    await page.goto('/')

    // Open sidebar
    await page.getByRole('button', { name: 'AI 助手' }).click()

    // Click new conversation button
    await page.getByRole('button', { name: '新对话' }).click()

    // Send a message to create a conversation
    const input = page.getByPlaceholder('向拾忆提问...')
    await input.fill('Test conversation')
    await page.keyboard.press('Enter')

    // Wait for conversation to appear in history
    await expect(page.getByText('Test conversation')).toBeVisible()

    // Delete the conversation
    const deleteButton = page.locator('[data-testid="delete-conversation"]').first()
    await deleteButton.click()

    // Confirm delete
    await page.getByRole('button', { name: '删除' }).click()

    // Conversation should be removed
    await expect(page.getByText('Test conversation')).not.toBeVisible()
  })

  test('chat sidebar supports dark mode', async ({ page }) => {
    await page.goto('/')

    // Toggle dark mode
    await page.getByRole('button', { name: '切换主题' }).click()

    // Open sidebar
    await page.getByRole('button', { name: 'AI 助手' }).click()

    // Sidebar should have dark mode class
    const sidebar = page.locator('[data-testid="chat-sidebar"]')
    await expect(sidebar).toHaveClass(/dark/)
  })
})
