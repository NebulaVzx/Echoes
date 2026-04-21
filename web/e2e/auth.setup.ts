import { test as setup, expect } from '@playwright/test'

const authFile = 'playwright/.auth/user.json'

setup('authenticate', async ({ page }) => {
  // Generate unique test user to avoid conflicts across runs
  const timestamp = Date.now()
  const email = `test_${timestamp}@example.com`
  const password = 'TestPassword123!'
  const username = `testuser_${timestamp}`

  // 1. Navigate to register page
  await page.goto('/register')

  // 2. Fill registration form
  await page.getByLabel('用户名').fill(username)
  await page.getByLabel('邮箱', { exact: true }).fill(email)
  await page.getByLabel('密码', { exact: true }).fill(password)

  // 3. Submit registration
  await page.getByRole('button', { name: '注册' }).click()

  // 4. Wait for redirect to home (auto-login after registration)
  await page.waitForURL('/')

  // 5. Verify we're logged in by checking for timeline header
  await expect(page.getByText('时间轴')).toBeVisible()

  // 6. Save auth state for reuse across tests
  await page.context().storageState({ path: authFile })
})
