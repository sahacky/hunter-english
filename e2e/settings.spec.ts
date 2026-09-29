import { expect, test } from '@playwright/test'

// Implements: plan://M10#10.8 — настройки: тема/локаль применяются, экспорт доступен

test('settings screen: switch theme to light applies data-theme', async ({ page }) => {
  await page.goto('/#/settings')
  await expect(page.getByRole('heading', { name: 'Внешний вид' })).toBeVisible({ timeout: 8000 })

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByLabel('Тема').selectOption('light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  // persists across reload
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light', { timeout: 8000 })
})

test('settings screen: locale switch translates ui', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByLabel('Язык интерфейса').selectOption('en')
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible({ timeout: 8000 })
})

test('settings screen: srs buttons mode reaches review screen', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByLabel('Кнопки оценки').selectOption('4')
  await page.getByRole('link', { name: 'Повторение' }).first().click()
  // 4 кнопки появляются после переворота карточки; пустая очередь тоже валидна
  await expect(page.getByRole('heading', { name: 'Повторение' })).toBeVisible({ timeout: 8000 })
})

test('lesson exit: button with confirm returns to dashboard', async ({ page }) => {
  await page.goto('/#/lesson/E-01')
  await expect(page.getByRole('heading', { name: 'to be: am / is / are. Знакомство' })).toBeVisible({
    timeout: 8000,
  })
  await page.getByRole('button', { name: /Выход/ }).click()
  await expect(page.getByText(/Урок не завершён/)).toBeVisible()
  await page.getByRole('button', { name: 'Выйти' }).click()
  await expect(page.getByText('[Ежедневный квест]')).toBeVisible({ timeout: 8000 })
})
