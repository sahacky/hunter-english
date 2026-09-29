import { expect, test } from '@playwright/test'

// Implements: plan://M12#12.5 — smoke контента ранга D (модули D1–D2)

test('lesson D-01 opens with rule step (Present Continuous)', async ({ page }) => {
  await page.goto('/#/lesson/D-01')
  await expect(
    page.getByRole('heading', { name: 'Present Continuous: процесс. still, these days' }),
  ).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('am / is / are + глагол+-ing')).toBeVisible()
  await expect(page.getByRole('button', { name: /Понятно/ })).toBeVisible()
})

test('lesson D-01 rule step advances to cloze', async ({ page }) => {
  await page.goto('/#/lesson/D-01')
  await page.getByRole('button', { name: /Понятно/ }).click()
  const input = page.getByRole('textbox')
  await expect(input).toBeVisible()
  await input.fill('am')
  await page.getByRole('button', { name: /Проверить/ }).click()
  await expect(page.getByText('Верно!')).toBeVisible()
})

test('lesson D-02 stative verbs rule mentions the trap', async ({ page }) => {
  await page.goto('/#/lesson/D-02')
  await expect(
    page.getByRole('heading', { name: 'Глаголы состояния: know, want, love — без Continuous' }),
  ).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('Ловушка')).toBeVisible()
})

test('phrasebook: directions chapter listed (locked until rank D)', async ({ page }) => {
  await page.goto('/#/phrasebook')
  await expect(page.getByText('Ориентирование')).toBeVisible({ timeout: 8000 })
})
