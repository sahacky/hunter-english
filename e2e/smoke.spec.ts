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

test('lesson E-01 opens with rule step (plan://M5#5.7 smoke)', async ({ page }) => {
  await page.goto('/#/lesson/E-01')
  await expect(
    page.getByRole('heading', { name: 'to be: am / is / are. Знакомство' }),
  ).toBeVisible()
  await expect(page.getByText('Глагол to be в настоящем времени')).toBeVisible()
  await expect(page.getByRole('button', { name: /Понятно/ })).toBeVisible()
})

test('lesson invalid id renders 404', async ({ page }) => {
  await page.goto('/#/lesson/E-99')
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
})

test('lesson rule step advances to cloze', async ({ page }) => {
  await page.goto('/#/lesson/E-01')
  await page.getByRole('button', { name: /Понятно/ }).click()
  const input = page.getByRole('textbox')
  await expect(input).toBeVisible()
  await input.fill('am')
  await page.getByRole('button', { name: /Проверить/ }).click()
  await expect(page.getByText('Верно!')).toBeVisible()
  await page
    .getByRole('button', { name: /Дальше/ })
    .first()
    .click()
})
