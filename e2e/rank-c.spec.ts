import { expect, test } from '@playwright/test'

// Implements: plan://M14#14.6 — smoke контента ранга C (модули C1–C2)

test('lesson C-01 opens with Past Simple rule', async ({ page }) => {
  await page.goto('/#/lesson/C-01')
  await expect(
    page.getByRole('heading', { name: 'Past Simple: правильные глаголы (-ed)' }),
  ).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('visit → visited')).toBeVisible()
})

test('lesson C-01 cloze works', async ({ page }) => {
  await page.goto('/#/lesson/C-01')
  await page.getByRole('button', { name: /Понятно/ }).click()
  const input = page.getByRole('textbox')
  await expect(input).toBeVisible()
  await input.fill('visited')
  await page.getByRole('button', { name: /Проверить/ }).click()
  await expect(page.getByText('Верно!')).toBeVisible()
})

test('lesson C-11 will rule mentions contractions', async ({ page }) => {
  await page.goto('/#/lesson/C-11')
  await expect(page.getByRole('heading', { name: /Future Simple: will/ })).toBeVisible({
    timeout: 8000,
  })
  await expect(page.getByText(/I'll call/)).toBeVisible()
})

test('phrasebook: hotel chapter listed (rank C)', async ({ page }) => {
  await page.goto('/#/phrasebook')
  await expect(page.getByText('Отель')).toBeVisible({ timeout: 8000 })
})

test('lesson C-16 must/have to opens', async ({ page }) => {
  await page.goto('/#/lesson/C-16')
  await expect(page.getByRole('heading', { name: 'must / have to: необходимость' })).toBeVisible({
    timeout: 8000,
  })
  await expect(
    page.getByText('mustn’t = «запрещено»').or(page.getByText(/mustn't = «запрещено»/)),
  ).toBeVisible()
})

test('gates C-B: intro with rank C checklist (plan://M14#14.7)', async ({ page }) => {
  await page.goto('/#/gates/C-B')
  await expect(page.getByRole('heading', { name: 'Врата C → B' })).toBeVisible({ timeout: 8000 })
  await expect(page.getByText(/Уроки ранга C: \d+ \/ 30/)).toBeVisible()
  await expect(page.getByText(/Слова \(надёжно\): \d+ \/ 1800/)).toBeVisible()
})

test('phrasebook: passport and restaurant chapters listed (rank C)', async ({ page }) => {
  await page.goto('/#/phrasebook')
  await expect(page.getByText('Паспортный контроль')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('Ресторан')).toBeVisible()
})
