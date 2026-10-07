import { expect, test } from '@playwright/test'

// Implements: plan://M9#9.4 — мобильный лейаут и PWA-обвязка (specs/07 §1, specs/08 §2)

test.use({ viewport: { width: 390, height: 844 } })

test('mobile 390: tab bar visible, desktop nav hidden (M9)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hunter-onboarding-done', '1'))
  await page.goto('/#/')
  const tabbar = page.getByRole('navigation', { name: 'Нижняя навигация' })
  await expect(tabbar).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeHidden()

  const links = tabbar.getByRole('link')
  await expect(links).toHaveCount(5)
})

test('mobile 390: tab bar navigation works', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hunter-onboarding-done', '1'))
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
  await expect(page.getByRole('heading', { name: 'Ежедневный квест' })).toBeVisible({
    timeout: 8000,
  })
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

  const audio = await request.get('./audio/words/emma/house-noun.opus')
  expect(audio.status()).toBe(200)
})

test('offline: app shell and cached audio served by service worker (M9)', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => localStorage.setItem('hunter-onboarding-done', '1'))
  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: 'Ежедневный квест' })).toBeVisible({
    timeout: 8000,
  })

  // ждём активацию SW: контроллер страницы появляется только после claim
  // (Known Issue M9 закрыт: регистрация ≠ активация — прогрев аудио до claim
  // уходит в сеть мимо SW → пустой audio-cache → офлайн-фетч падает, флейк ~5%)
  await expect
    .poll(async () => (await context.serviceWorkers()).length, { timeout: 10000 })
    .toBeGreaterThanOrEqual(1)
  await expect
    .poll(async () => await page.evaluate(() => navigator.serviceWorker.controller !== null), {
      timeout: 15000,
      message: 'SW не контролирует страницу (не активировался/claim)',
    })
    .toBe(true)

  // прогреваем аудио через страницу (runtime-кэш CacheFirst)
  const warm = await page.evaluate(async () => {
    const res = await fetch('audio/words/emma/house-noun.opus')
    return res.status
  })
  expect(warm).toBe(200)

  await context.setOffline(true)
  try {
    // app shell из SW
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Ежедневный квест' })).toBeVisible({
      timeout: 8000,
    })

    // аудио из audio-cache без сети
    const cached = await page.evaluate(async () => {
      const res = await fetch('audio/words/emma/house-noun.opus')
      return { status: res.status, size: (await res.arrayBuffer()).byteLength }
    })
    expect(cached.status).toBe(200)
    expect(cached.size).toBeGreaterThan(1000)
  } finally {
    await context.setOffline(false)
  }
})
