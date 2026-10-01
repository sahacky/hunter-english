import { expect, test } from '@playwright/test'

// Implements: plan://M21#21.3 — GAP-8 хвосты (specs/09 §8): тач-цели и reduced-motion

test.use({ viewport: { width: 375, height: 667 } }) // мобильный (iPhone SE)

test('тач-цели: кнопки ответов SRS ≥ 44px по высоте на мобильном', async ({ page }) => {
  await page.goto('/#/srs')
  // карточка появляется после бутстрапа очереди
  await expect(page.getByRole('button', { name: /Показать/ })).toBeVisible({ timeout: 8000 })
  const targets = await page.$$eval('button', (buttons) =>
    buttons
      .filter((b) => b.className.includes('srs-btn'))
      .map((b) => ({ text: b.textContent ?? '', height: b.getBoundingClientRect().height })),
  )
  expect(targets.length).toBeGreaterThan(0)
  for (const t of targets) {
    expect(t.height, `кнопка «${t.text}» ниже тач-цели`).toBeGreaterThanOrEqual(44)
  }
})

test('reduced-motion: media-правила для волны и тоста присутствуют в стилях', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('hunter-onboarding-done', '1'))
  await page.goto('/#/')
  const hasRules = await page.evaluate(() => {
    let wave = false
    let toast = false
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSMediaRule)) continue
        if (!rule.conditionText.includes('prefers-reduced-motion')) continue
        for (const inner of Array.from(rule.cssRules)) {
          if (inner.cssText.includes('.lesson-wave-bar')) wave = true
          if (inner.cssText.includes('.toast')) toast = true
        }
      }
    }
    return { wave, toast }
  })
  expect(hasRules.wave).toBe(true)
  expect(hasRules.toast).toBe(true)
})
