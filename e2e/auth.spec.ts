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
  await page.addInitScript(() => localStorage.setItem('hunter-onboarding-done', '1'))
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

// Implements: plan://M18 — GAP-8 specs/09 §4.9 (TC-E2E-05/TC-PERF-01: чанк supabase-js не грузится гостю)
test('guest session loads no supabase chunks (lazy-import behind env gate)', async ({ page }) => {
  const supabaseRequests: string[] = []
  page.on('response', (response) => {
    if (response.url().includes('supabase')) supabaseRequests.push(response.url())
  })
  await page.addInitScript(() => localStorage.setItem('hunter-onboarding-done', '1'))
  await page.goto('/#/login')
  await page.getByRole('link', { name: /Продолжить как гость/ }).click()
  await expect(page.getByText('[Ежедневный квест]')).toBeVisible({ timeout: 8000 })
  // прогрев навигации: экраны, за которыми может прятаться sync
  await page.goto('/#/settings')
  await expect(page.getByRole('heading', { name: 'Аккаунт' })).toBeVisible({ timeout: 8000 })
  expect(supabaseRequests).toEqual([])
})
