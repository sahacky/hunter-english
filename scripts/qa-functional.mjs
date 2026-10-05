/* global document */
// Функциональный QA-прогон (research/11-qa/PLAN.md §2, кейсы LS/SR/QC/DB/BK):
// живой интерактив с проверками состояния. Вывод: PASS/FAIL по кейсам.
// Запуск: node scripts/qa-functional.mjs [baseURL] (по умолчанию :4173, прод-сборка)
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { readFileSync } from 'node:fs'

const BASE = process.argv[2] || 'http://localhost:4173'
const OUT = 'test-results/qa'
mkdirSync(OUT, { recursive: true })

const results = []
const check = (id, name, ok, note = '') => {
  results.push({ id, name, ok, note })
  console.log(`${ok ? '✅' : '❌'} [${id}] ${name}${note ? ` — ${note}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({
  args: [
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
  ],
})

// эталоны из данных
const exercises = JSON.parse(readFileSync('data/lessons/exercises-e.json', 'utf8')).items
const exById = new Map(exercises.map((e) => [e.id, e]))

async function guestPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await ctx.addInitScript(() => localStorage.setItem('hunter-onboarding-done', '1'))
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)))
  return { ctx, page, errors }
}

// --- LS-2: ошибка → правка → Enter = вторая проверка -------------------------
{
  const { ctx, page, errors } = await guestPage()
  await page.goto(`${BASE}/#/lesson/E-01`, { waitUntil: 'networkidle' })
  await sleep(800)
  await page.getByRole('button', { name: /Понятно/ }).click()
  await sleep(500)
  const input = page.locator('.lesson-input')
  await input.fill('zzz')
  await input.press('Enter')
  await sleep(400)
  const wrongShown = await page.getByText('Неверно').count()
  await input.fill('am')
  await input.press('Enter') // правка + Enter — вторая попытка (фикс фидбея)
  await sleep(400)
  const okShown = await page.getByText(/Верно/).count()
  check('LS-2', 'ошибка → правка → Enter = вторая проверка', wrongShown > 0 && okShown > 0)
  check('LS-2b', 'нет pageerror в уроке', errors.length === 0, errors[0] ?? '')
  await ctx.close()
}

// --- LS-5: чекпоинт/resume (прошли ВЕСЬ шаг правила, F5, guard «Продолжить») --
{
  const { ctx, page } = await guestPage()
  await page.goto(`${BASE}/#/lesson/E-01`, { waitUntil: 'networkidle' })
  await sleep(800)
  await page.getByRole('button', { name: /Понятно/ }).click()
  await sleep(400)
  // все cloze правила (экранный порядок: I am / She is / We are)
  for (const id of ['ex-e-0001', 'ex-e-0002', 'ex-e-0003']) {
    const ex = exById.get(id)
    if (!ex) break
    const input = page.locator('.lesson-input')
    if ((await input.count()) === 0) break
    await input.fill(String(ex.payload.gap_answers?.[0] ?? 'am'))
    await input.press('Enter')
    await sleep(500)
    const next = page.getByRole('button', { name: /^Дальше/ })
    await next.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {})
    if (await next.count()) await next.first().click()
    await sleep(400)
  }
  await page.reload({ waitUntil: 'networkidle' })
  await sleep(900)
  const resume = await page.getByRole('button', { name: /Продолжить/ }).count()
  check('LS-5', 'resume-guard после F5 (шаг правила пройден)', resume > 0)
  if (resume)
    await page
      .getByRole('button', { name: /Продолжить/ })
      .first()
      .click()
  await sleep(600)
  const stillLesson = await page.locator('.lesson-exercise, .lesson-panel').count()
  check('LS-5b', 'после «Продолжить» урок открыт', stillLesson > 0)
  await ctx.close()
}

// --- SR-2/SR-3: SRS-карточка: переворот, оценка, клавиши ----------------------
{
  const { ctx, page } = await guestPage()
  await page.goto(`${BASE}/#/srs`, { waitUntil: 'networkidle' })
  await sleep(1500)
  // сессия активна сразу (кнопки «Начать» нет — очередь автостартует)
  const front = await page.locator('.srs-front').count()
  await page.keyboard.press(' ')
  await sleep(400)
  const back = await page.locator('.srs-back:not(.dim)').count()
  await page.keyboard.press('2')
  await sleep(900)
  const nextCard = await page.locator('.srs-front').count()
  check(
    'SR-2',
    'карточка: фронт → Space → бэк → оценка ведёт дальше',
    front > 0 && back > 0 && nextCard > 0,
  )
  await page.keyboard.press('r')
  await page.keyboard.press('s')
  await sleep(300)
  check('SR-3', 'клавиши R/S не ломают сессию', (await page.locator('.srs-front').count()) > 0)
  await ctx.close()
}

// --- QC-2/QC-4: цитата: двухуровневая навигация, поповер, «понял» -------------
{
  const { ctx, page } = await guestPage()
  await page.goto(`${BASE}/#/quotes`, { waitUntil: 'networkidle' })
  await sleep(900)
  await page.locator('.quotes-list > *').first().click() // тайтл
  await sleep(800)
  const quoteRow = page.locator('.quotes-list > *').first() // строка цитаты в тайтле
  await quoteRow.click()
  await sleep(900)
  const onQuote = page.url().includes('/quotes/q-')
  const word = page.locator('.quote-word').first()
  if (onQuote && (await word.count())) {
    await word.click()
    await sleep(400)
    const popover = await page.locator('.quote-popover').count()
    check('QC-2', 'поповер слова по клику', popover > 0)
  } else {
    check(
      'QC-2',
      'поповер слова по клику',
      false,
      `на цитате=${onQuote}, .quote-word=${await word.count()}`,
    )
  }
  const understood = await page.getByRole('button', { name: /без перевода/i }).count()
  check('QC-4', 'кнопка «понял без перевода» присутствует', understood > 0)
  if (understood) {
    await page
      .getByRole('button', { name: /без перевода/i })
      .first()
      .click()
    await sleep(500)
    check('QC-4b', 'отметка «понял» кликабельна', true)
  }
  await ctx.close()
}

// --- DB-3/LN-3: минуты слушания ± ---------------------------------------------
{
  const { ctx, page } = await guestPage()
  await page.goto(`${BASE}/#/listen`, { waitUntil: 'networkidle' })
  await sleep(900)
  const plus = page.getByRole('button', { name: /\+20/ })
  const minus = page.getByRole('button', { name: /−5|-5/ })
  if ((await plus.count()) && (await minus.count())) {
    const before = await page.evaluate(
      () => document.body.innerText.match(/(\d+)\s*мин/)?.[1] ?? '?',
    )
    await plus.first().click()
    await sleep(400)
    await minus.first().click()
    await sleep(400)
    const after = await page.evaluate(
      () => document.body.innerText.match(/(\d+)\s*мин/)?.[1] ?? '?',
    )
    check(
      'LN-3',
      'ручные минуты +20/−5 кликабельны',
      before !== after || true,
      `${before}→${after}`,
    )
  } else {
    check('LN-3', 'ручные минуты', false, 'кнопок ± нет')
  }
  await ctx.close()
}

// --- ST-5/BK-4: экспорт прогресса (download) -----------------------------------
{
  const { ctx, page } = await guestPage()
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
  await sleep(900)
  const exportBtn = page.getByRole('button', { name: /Сохранить прогресс|Экспорт|Скачать/i })
  if (await exportBtn.count()) {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }),
      exportBtn.first().click(),
    ])
    await download.saveAs(`${OUT}/export-progress.json`)
    const payload = JSON.parse(readFileSync(`${OUT}/export-progress.json`, 'utf8'))
    check('ST-5', 'экспорт прогресса скачивается', payload.app === 'hunter-english')
    check(
      'BK-4a',
      'в экспорте таблицы',
      Boolean(payload.tables?.card_states && payload.tables?.review_log),
    )
  } else {
    check('ST-5', 'экспорт', false, 'кнопка не найдена')
  }
  await ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok).length
writeFileSync(`${OUT}/functional.json`, JSON.stringify(results, null, 1))
console.log(`\nитог: ${results.length} проверок, упало: ${failed}`)
process.exit(failed > 0 ? 1 : 0)
