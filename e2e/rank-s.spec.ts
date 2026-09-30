import { expect, test } from '@playwright/test'

// Implements: plan://M20#20.6 — smoke контента ранга S (модули S1–S3) + Финал S-FINAL

test('lesson S-01 advanced inversion opens', async ({ page }) => {
  await page.goto('/#/lesson/S-01')
  await expect(page.getByRole('heading', { name: /Инверсия продвинутая/ })).toBeVisible({
    timeout: 8000,
  })
  await expect(page.getByText(/Not only.*No sooner/).first()).toBeVisible()
})

test('lesson S-05 slang opens', async ({ page }) => {
  await page.goto('/#/lesson/S-05')
  await expect(page.getByRole('heading', { name: /gonna\/wanna\/gotta/ })).toBeVisible({
    timeout: 8000,
  })
})

test('lesson S-07 C1 decks opens with 10 quotes step', async ({ page }) => {
  await page.goto('/#/lesson/S-07')
  await expect(page.getByRole('heading', { name: /Колоды C1/ })).toBeVisible({ timeout: 8000 })
  await expect(page.getByText(/JJK и Black Mirror/).first()).toBeVisible()
})

test('lesson S-11 free talk capsule opens', async ({ page }) => {
  await page.goto('/#/lesson/S-11')
  await expect(page.getByRole('heading', { name: /Free talk/ })).toBeVisible({ timeout: 8000 })
})

test('lesson S-13 false friends opens', async ({ page }) => {
  await page.goto('/#/lesson/S-13')
  await expect(page.getByRole('heading', { name: /False friends/ })).toBeVisible({
    timeout: 8000,
  })
})

test('lesson S-15 scene deck opens', async ({ page }) => {
  await page.goto('/#/lesson/S-15')
  await expect(page.getByRole('heading', { name: /Разбор сцены/ })).toBeVisible({
    timeout: 8000,
  })
})

test('gates S-FINAL: intro with rank S checklist (plan://M20#20.4)', async ({ page }) => {
  await page.goto('/#/gates/S-FINAL')
  await expect(page.getByRole('heading', { name: /Финальное испытание/ })).toBeVisible({
    timeout: 8000,
  })
  await expect(page.getByText(/Уроки ранга S: \d+ \/ 15/)).toBeVisible()
  await expect(page.getByText(/Слова \(надёжно\): \d+ \/ 5000/)).toBeVisible()
})

test('gates S-FINAL: unknown gate id still 404', async ({ page }) => {
  await page.goto('/#/gates/S-X')
  await expect(page.getByText('Такие Врата не существуют.')).toBeVisible({ timeout: 8000 })
})
