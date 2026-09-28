import { expect, test } from '@playwright/test'

// Implements: plan://M9#9.4 — мобильный лейаут и PWA-обвязка (specs/07 §1, specs/08 §2)

test.use({ viewport: { width: 390, height: 844 } })

test('mobile 390: tab bar visible, desktop nav hidden (M9)', async ({ page }) => {
  await page.goto('/#/')
  const tabbar = page.getByRole('navigation', { name: 'Нижняя навигация' })
  await expect(tabbar).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeHidden()

  const links = tabbar.getByRole('link')
  await expect(links).toHaveCount(5)
})

test('mobile 390: tab bar navigation works', async ({ page }) => {
  await page.goto('/#/')
  await page
    .getByRole('navigation', { name: 'Нижняя навигация' })
    .getByRole('link', { name: 'Повторение' })
    .click()
  await expect(page.getByRole('heading', { name: 'Повторение' })).toBeVisible({ timeout: 8000 })

  // возврат на дашборд
  await page
    .getByRole('navigation', { name: 'Нижняя навигация' })
    .getByRole('link', { name: 'Дашборд' })
    .click()
  await expect(page.getByText('[Ежедневный квест]')).toBeVisible({ timeout: 8000 })
})

test('pwa: manifest and service worker are served (M9)', async ({ request }) => {
  const manifest = await request.get('./manifest.webmanifest')
  expect(manifest.status()).toBe(200)
  const body = (await manifest.json()) as { name?: string; icons?: { src: string }[] }
  expect(body.name).toBe('Hunter English')
  expect(body.icons?.length).toBeGreaterThanOrEqual(2)

  const sw = await request.get('./sw.js')
  expect(sw.status()).toBe(200)
  const swText = await sw.text()
  // аудио — runtime-кэш, не precache (решение M9#2)
  expect(swText).toContain('audio-cache')
  expect(swText).not.toMatch(/precache.*\.opus/)
})

test('pwa: icons and audio sample are served from dist', async ({ request }) => {
  const icon = await request.get('./icons/icon-192.png')
  expect(icon.status()).toBe(200)

  const audio = await request.get('./audio/words/cori/house-noun.opus')
  expect(audio.status()).toBe(200)
})
