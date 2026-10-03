import { expect, test } from '@playwright/test'

// Implements: plan://M15#15.3 — smoke контента ранга B (модули B1–B2)

test('lesson B-01 opens with Present Perfect rule', async ({ page }) => {
  await page.goto('/#/lesson/B-01')
  await expect(page.getByRole('heading', { name: 'Present Perfect: have + V3' })).toBeVisible({
    timeout: 8000,
  })
  await expect(page.getByText(/have\/has \+ 3-я форма/)).toBeVisible()
})

test('lesson B-01 cloze works', async ({ page }) => {
  await page.goto('/#/lesson/B-01')
  await page.getByRole('button', { name: /Понятно/ }).click()
  const input = page.getByRole('textbox')
  await expect(input).toBeVisible()
  await input.fill('have')
  await page.getByRole('button', { name: /Проверить/ }).click()
  await expect(page.getByText('Верно!')).toBeVisible()
})

test('lesson B-10 conditionals mentions if without will', async ({ page }) => {
  await page.goto('/#/lesson/B-10')
  await expect(page.getByRole('heading', { name: /Условные 0 и 1/ })).toBeVisible({
    timeout: 8000,
  })
  await expect(page.getByText(/if it will rain/)).toBeVisible()
})

test('lesson B-13 used to mentions arrow in the knee', async ({ page }) => {
  await page.goto('/#/lesson/B-13')
  await expect(page.getByRole('heading', { name: 'used to: «раньше»' })).toBeVisible({
    timeout: 8000,
  })
  await expect(page.getByText(/«раньше было»/).first()).toBeVisible()
  await expect(page.getByText(/«привык»/).first()).toBeVisible()
})

test('lesson B-15 relative clauses opens', async ({ page }) => {
  await page.goto('/#/lesson/B-15')
  await expect(page.getByRole('heading', { name: /Relative clauses/ })).toBeVisible({
    timeout: 8000,
  })
})

test('lesson B-20 passive voice opens', async ({ page }) => {
  await page.goto('/#/lesson/B-20')
  await expect(page.getByRole('heading', { name: /Пассив/ })).toBeVisible({ timeout: 8000 })
  await expect(page.getByText(/be \+ V3/).first()).toBeVisible()
})

test('lesson B-27 speed scenes opens with rule (specs/01 §8)', async ({ page }) => {
  await page.goto('/#/lesson/B-27')
  await expect(page.getByRole('heading', { name: 'Диалог-сценки на скорости' })).toBeVisible({
    timeout: 8000,
  })
  // правило «пример до термина»: живой обмен → термин → правила скорости
  await expect(page.getByText(/диалог-сценка на скорости/).first()).toBeVisible()
  await expect(page.getByText(/своими словами можно всегда/).first()).toBeVisible()
})

test('gates B-A: intro with rank B checklist (plan://M15#15.4)', async ({ page }) => {
  await page.goto('/#/gates/B-A')
  await expect(page.getByRole('heading', { name: 'Врата B → A' })).toBeVisible({ timeout: 8000 })
  await expect(page.getByText(/Уроки ранга B: \d+ \/ 30/)).toBeVisible()
  await expect(page.getByText(/Слова \(надёжно\): \d+ \/ 2800/)).toBeVisible()
})
