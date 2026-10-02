import { expect, test } from '@playwright/test'

test('dashboard renders quest and status windows (M7)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hunter-onboarding-done', '1'))
  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: 'Ежедневный квест' })).toBeVisible({
    timeout: 8000,
  })
  await expect(page.getByText('Статус')).toBeVisible()
  await expect(page.getByText(/Охотник E-ранга/)).toBeVisible()
  await expect(page.getByRole('link', { name: /Начать день/ })).toBeVisible()
})

test('navigation to srs works', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hunter-onboarding-done', '1'))
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

// Implements: plan://ux-feedback-2#U.3 — первый вход: intro (лор) → «Начать» → welcome
test('welcome on first visit: start from scratch lands on dashboard (plan://onboarding)', async ({
  page,
}) => {
  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: 'Hunter English' })).toBeVisible({
    timeout: 8000,
  })
  // лор и суть — на странице знакомства
  await expect(page.getByText(/Ты — Охотник, а это — Система/)).toBeVisible()
  await page.getByRole('button', { name: /Начать/ }).click()
  await expect(page.getByRole('heading', { name: 'Регистрация Охотника' })).toBeVisible({
    timeout: 8000,
  })
  await page.getByRole('button', { name: 'Начать с нуля (ранг E)' }).click()
  await expect(page.getByRole('heading', { name: /Ежедневный квест|Охотник/ })).toBeVisible({
    timeout: 8000,
  })
  // повторный вход — welcome больше не показывается
  await page.goto('/#/welcome')
  await expect(page.getByRole('heading', { name: 'Регистрация Охотника' })).toBeHidden()
})

// Implements: plan://curriculum-review#P.1 — «не знаю» закрывает полосу, вердикт с низкой
// уверенностью; rank E применяется без экрана выбора (ниже E уроков нет)
test('assessment: two «не знаю» close band E → verdict E low → applied (plan://curriculum-review)', async ({
  page,
}) => {
  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: 'Hunter English' })).toBeVisible({
    timeout: 8000,
  })
  await page.getByRole('button', { name: /Начать/ }).click()
  await expect(page.getByRole('heading', { name: 'Регистрация Охотника' })).toBeVisible({
    timeout: 8000,
  })
  await page.getByRole('button', { name: 'Пройти оценку ранга' }).click()
  await page.getByRole('button', { name: 'Не знаю' }).click()
  await expect(page.getByRole('button', { name: /Дальше/ }).first()).toBeVisible()
  await page
    .getByRole('button', { name: /Дальше/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Не знаю' }).click()
  await page
    .getByRole('button', { name: /Дальше/ })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: 'Система назначает ранг' })).toBeVisible()
  await expect(page.getByText('E (A0)', { exact: true })).toBeVisible()
  await expect(page.getByText(/Система сомневалась/)).toBeVisible()
  await page.getByRole('button', { name: 'Начать с ранга E (A0)' }).click()
  await expect(page.getByRole('heading', { name: /Ежедневный квест|Охотник/ })).toBeVisible({
    timeout: 8000,
  })
})

test('path screen lists program ranks (plan://onboarding)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hunter-onboarding-done', '1'))
  await page.goto('/#/path')
  await expect(page.getByRole('heading', { name: 'Программа обучения' })).toBeVisible({
    timeout: 8000,
  })
  await expect(page.getByText(/Ранг E \(A0\) · 0\/24 уроков/)).toBeVisible()
  await expect(page.getByText('ты здесь')).toBeVisible()
})
