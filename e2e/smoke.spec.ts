import { expect, test } from '@playwright/test'

test('dashboard renders greeting', async ({ page }) => {
  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: 'Добро пожаловать, Охотник' })).toBeVisible()
})

test('navigation to srs works', async ({ page }) => {
  await page.goto('/#/')
  await page.getByRole('link', { name: 'Повторение' }).click()
  await expect(page.getByRole('heading', { name: 'Повторение' })).toBeVisible()
})
