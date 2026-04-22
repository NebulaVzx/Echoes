import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('login page loads with all required fields', async ({ page }) => {
    await page.goto('/login')

    // Verify page title
    await expect(page.getByRole('heading', { name: 'Echoes' })).toBeVisible()
    await expect(page.getByText('登录你的账户')).toBeVisible()

    // Verify form fields
    await expect(page.getByLabel('邮箱', { exact: true })).toBeVisible()
    await expect(page.getByLabel('密码', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible()

    // Verify register link
    await expect(page.getByRole('link', { name: '注册' })).toBeVisible()
  })

  test('register page loads with all required fields', async ({ page }) => {
    await page.goto('/register')

    // Verify page title
    await expect(page.getByRole('heading', { name: 'Echoes' })).toBeVisible()
    await expect(page.getByText('创建你的账户')).toBeVisible()

    // Verify form fields
    await expect(page.getByLabel('用户名')).toBeVisible()
    await expect(page.getByLabel('邮箱', { exact: true })).toBeVisible()
    await expect(page.getByLabel('密码', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '注册' })).toBeVisible()

    // Verify login link
    await expect(page.getByRole('link', { name: '登录' })).toBeVisible()
  })

  test('invalid login shows error toast', async ({ page }) => {
    await page.goto('/login')

    // Fill with non-existent credentials
    await page.getByLabel('邮箱', { exact: true }).fill('wrong@example.com')
    await page.getByLabel('密码', { exact: true }).fill('wrongpassword')
    await page.getByRole('button', { name: '登录' }).click()

    // Wait for error toast/message
    await expect(
      page.getByText(/失败|错误|error|invalid|不存在/i).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('registration with valid credentials redirects to home', async ({ page }) => {
    const timestamp = Date.now()
    const email = `e2e_reg_${timestamp}@example.com`
    const password = 'TestPassword123!'
    const username = `e2euser_${timestamp}`

    await page.goto('/register')

    // Fill registration form
    await page.getByLabel('用户名').fill(username)
    await page.getByLabel('邮箱', { exact: true }).fill(email)
    await page.getByLabel('密码', { exact: true }).fill(password)

    // Submit
    await page.getByRole('button', { name: '注册' }).click()

    // Should redirect to home and show timeline
    await page.waitForURL('/')
    await expect(page.getByText('时间轴')).toBeVisible()
  })
})
