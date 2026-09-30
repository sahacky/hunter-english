import { expect, test } from '@playwright/test'

// Implements: plan://M16#16.3 — smoke контента ранга A (модули A1–A2)

test('lesson A-01 Future Continuous opens', async ({ page }) => {
  await page.goto('/#/lesson/A-01')
  await expect(page.getByRole('heading', { name: /Future Continuous/ })).toBeVisible({
    timeout: 8000,
  })
  await expect(page.getByText(/will be \+ V-ing/)).toBeVisible()
})

test('lesson A-07 modal perfects opens', async ({ page }) => {
  await page.goto('/#/lesson/A-07')
  await expect(page.getByRole('heading', { name: /must have.*can't have/ })).toBeVisible({
    timeout: 8000,
  })
})

test('lesson A-09 third conditional opens', async ({ page }) => {
  await page.goto('/#/lesson/A-09')
  await expect(page.getByRole('heading', { name: /3-е условное: If I had studied/ })).toBeVisible({
    timeout: 8000,
  })
  await expect(page.getByText(/If I had studied, I would have passed/).first()).toBeVisible()
})

test('gates A-S: intro with rank A checklist (plan://M16#16.3)', async ({ page }) => {
  await page.goto('/#/gates/A-S')
  await expect(page.getByRole('heading', { name: 'Врата A → S' })).toBeVisible({ timeout: 8000 })
  await expect(page.getByText(/Уроки ранга A: \d+ \/ 22/)).toBeVisible()
  await expect(page.getByText(/Слова \(надёжно\): \d+ \/ 4000/)).toBeVisible()
})

test('lesson A-12 causative opens (plan://M16#16.4)', async ({ page }) => {
  await page.goto('/#/lesson/A-12')
  await expect(page.getByRole('heading', { name: /have something done/ })).toBeVisible({
    timeout: 8000,
  })
})

test('lesson A-19 inversion opens (plan://M16#16.4)', async ({ page }) => {
  await page.goto('/#/lesson/A-19')
  await expect(page.getByRole('heading', { name: /Инверсия/ })).toBeVisible({ timeout: 8000 })
})

test('lesson A-22 final review opens (plan://M16#16.4)', async ({ page }) => {
  await page.goto('/#/lesson/A-22')
  await expect(page.getByRole('heading', { name: /Большое повторение ранга A/ })).toBeVisible({
    timeout: 8000,
  })
})
