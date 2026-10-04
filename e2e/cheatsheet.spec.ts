// Implements: plan://teaching-quality#cheat-sheet — e2e-гард шпаргалки:
// скрыта в активной сессии (фокус), видна в финале, раскрытие ленивое.
// jsdom не эмулирует toggle <details> — реальный браузер проверяется только здесь.
import { expect, test } from '@playwright/test'

test('cheat sheet: скрыта в сессии, видна в финале, раскрытие без ошибок', async ({ page }) => {
  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: 'Hunter English' })).toBeVisible({
    timeout: 8000,
  })
  await page.getByRole('button', { name: /Начать/ }).click()
  await expect(page.getByRole('heading', { name: /Ежедневный квест|Охотник/ })).toBeVisible({
    timeout: 8000,
  })
  await page.goto('/#/srs')
  const summary = page.getByText('📖 Шпаргалка пройденного')
  // активная сессия (есть новые карточки) — блок скрыт
  await expect(page.getByText(/Показать ответ/)).toBeVisible({ timeout: 8000 })
  await expect(summary).toHaveCount(0)
  // «Закончить» → фаза done → блок появляется свёрнутым
  await page.getByRole('button', { name: 'Закончить' }).click()
  await expect(summary).toBeVisible({ timeout: 8000 })
  await expect(page.getByText(/Пока пусто/)).toHaveCount(0)
  // раскрытие: ленивая загрузка → пустое состояние (нет завершённых уроков)
  await summary.click()
  await expect(page.getByText(/Пока пусто/)).toBeVisible({ timeout: 5000 })
  // повторные раскрытия — без повторной загрузки и ошибок
  await summary.click()
  await summary.click()
  await expect(page.getByText(/Пока пусто/)).toBeVisible()
})
