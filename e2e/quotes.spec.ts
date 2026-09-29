import { expect, test } from '@playwright/test'

// Implements: plan://M11#11.6 — e2e экранов Цитат (specs/07 §2.1)

test('quotes: gallery → title → quote detail with coloring and cloze', async ({ page }) => {
  await page.goto('/#/quotes')
  await expect(page.getByRole('heading', { name: 'Цитаты' })).toBeVisible({ timeout: 8000 })

  // тайтл-карточка со счётчиком
  const card = page.getByRole('button', { name: /Supernatural/ }).first()
  await expect(card).toBeVisible()
  await card.click()

  // список цитат тайтла → первая цитата
  const quoteLink = page.locator('a[href^="#/quotes/q-"]').first()
  await expect(quoteLink).toBeVisible()
  await quoteLink.click()

  // детальная: слова-кнопки, RU скрыт, открывается
  await expect(page.locator('.quote-word').first()).toBeVisible({ timeout: 8000 })
  await expect(page.getByRole('button', { name: 'Показать перевод' })).toBeVisible()
  await page.getByRole('button', { name: 'Показать перевод' }).click()
  await expect(page.getByRole('button', { name: 'Скрыть перевод' })).toBeVisible()

  // поповер слова с переводом
  await page.locator('.quote-word').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Закрыть' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  // «понял без перевода» отмечается и переживает перезагрузку (item_progress)
  await page.getByRole('button', { name: /Понял без перевода/ }).click()
  await expect(page.getByText(/✓ понял без перевода/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/✓ понял без перевода/)).toBeVisible({ timeout: 8000 })
})

test('quotes: filter understandable hides titles when nothing known', async ({ page }) => {
  await page.goto('/#/quotes')
  await expect(page.getByRole('heading', { name: 'Цитаты' })).toBeVisible({ timeout: 8000 })
  await page.getByLabel('понятные мне сейчас').check()
  await expect(page.getByText('Колода собирается — цитаты появятся позже.')).toBeVisible()
})

test('quotes: invalid id renders 404', async ({ page }) => {
  await page.goto('/#/quotes/q-nope-0000')
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible({ timeout: 8000 })
})
