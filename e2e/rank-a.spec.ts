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
  await expect(page.getByText(/Уроки ранга A: \d+ \/ 11/)).toBeVisible()
  await expect(page.getByText(/Слова \(надёжно\): \d+ \/ 4000/)).toBeVisible()
})
