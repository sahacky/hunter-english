import { expect, test } from '@playwright/test'

// Implements: plan://M13#13.6 — гостевой режим без env: вход недоступен,
// приложение полноценно работает (specs/06 §3 offline)

test('login screen shows guest mode when sync is not configured', async ({ page }) => {
  await page.goto('/#/login')
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible({ timeout: 8000 })
  await expect(page.getByRole('link', { name: /Продолжить как гость/ })).toBeVisible()
  // без env — честная плашка, никаких форм входа
  await expect(page.getByText(/Синхронизация не настроена/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Google/ })).toHaveCount(0)
})

test('guest continue leads to dashboard and app works', async ({ page }) => {
  await page.goto('/#/login')
  await page.getByRole('link', { name: /Продолжить как гость/ }).click()
  await expect(page.getByText('[Ежедневный квест]')).toBeVisible({ timeout: 8000 })
})

test('settings shows guest account block', async ({ page }) => {
  await page.goto('/#/settings')
  await expect(page.getByRole('heading', { name: 'Аккаунт' })).toBeVisible({ timeout: 8000 })
  await expect(page.getByText(/Гостевой режим/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '#/login')
})
