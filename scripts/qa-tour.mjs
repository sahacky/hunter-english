/* global document */
// QA-скриншот-тур (research/11-qa/PLAN.md §5). Запуск:
//   npm run build && npx vite preview --port 4173 &
//   node scripts/qa-tour.mjs [baseURL]
// Скрины: test-results/qa/<ctx>/<page>.png. Тур «best-effort»: шаги в try/catch,
// ошибки страницы пишутся в test-results/qa/console-errors.log.
import { chromium, devices } from '@playwright/test'
import { mkdirSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs'
// readFileSync нужен для exercises-e.json ниже

const BASE = process.argv[2] || 'http://localhost:4173'
const OUT = 'test-results/qa'
mkdirSync(OUT, { recursive: true })
const logFile = `${OUT}/console-errors.log`
writeFileSync(logFile, '')

const logErr = (ctx, page, msg) => appendFileSync(logFile, `[${ctx}] ${page}: ${msg}\n`)

const browser = await chromium.launch({
  args: [
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
  ],
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function makeContext(name, { mobile = false, onboarded = true } = {}) {
  const ctx = await browser.newContext(
    mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 } },
  )
  if (onboarded) {
    await ctx.addInitScript(() => localStorage.setItem('hunter-onboarding-done', '1'))
  }
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') logErr(name, page.url().replace(BASE, ''), m.text().slice(0, 200))
  })
  page.on('pageerror', (e) =>
    logErr(name, page.url().replace(BASE, ''), `PAGEERROR ${e.message.slice(0, 200)}`),
  )
  return { ctx, page }
}

const shot = async (page, ctxName, name) => {
  await sleep(400) // даём дорисовать
  await page.screenshot({ path: `${OUT}/${ctxName}/${name}.png`, fullPage: true })
}

const go = async (page, hash) => {
  await page.goto(`${BASE}/#${hash}`, { waitUntil: 'networkidle' })
  await sleep(600) // ленивые чанки/настройки
}

// эталоны урока E-01 из данных (для интерактива)
const exercises = JSON.parse(readFileSync('data/lessons/exercises-e.json', 'utf8')).items
// фразы E-ранга (эталоны построения — при расширении интерактива)
const exById = new Map(exercises.map((e) => [e.id, e]))

// ---------------------------------------------------------------- контексты

// 1) FRESH: онбординг-флоу
{
  const { ctx, page } = await makeContext('fresh-desktop', { onboarded: false })
  await go(page, '/')
  await shot(page, 'fresh-desktop', '00-welcome')
  // «Не знаю» до вердикта
  for (let i = 0; i < 8; i += 1) {
    const btn = page.getByRole('button', { name: 'Не знаю' })
    if ((await btn.count()) === 0) break
    await btn.first().click()
    await sleep(250)
    if (i === 2) await shot(page, 'fresh-desktop', `01-assessment-step${i}`)
  }
  await shot(page, 'fresh-desktop', '02-verdict')
  const apply = page.getByRole('button', { name: /Начать с первого урока ранга/ })
  if ((await apply.count()) > 0) {
    await apply.first().click()
    await sleep(900)
  }
  await shot(page, 'fresh-desktop', '03-dashboard-after-apply')
  await ctx.close()
}

// 2) GUEST десктоп: все страницы + интерактив урока
{
  const { ctx, page } = await makeContext('guest-desktop')
  await go(page, '/')
  await shot(page, 'guest-desktop', '00-dashboard')

  await go(page, '/path')
  await shot(page, 'guest-desktop', '01-path')

  // урок E-01: правило → «Понятно» → первые задания всех типов
  await go(page, '/lesson/E-01')
  await shot(page, 'guest-desktop', '02-lesson-rule')
  await page
    .getByRole('button', { name: /Понятно/ })
    .click()
    .catch(() => {})
  await sleep(500)
  // cloze правила (ex-e-0002: gap am)
  const first = exById.get('ex-e-0002')
  if (first) {
    const gap = first.payload.gap_answers?.[0] ?? 'am'
    await page
      .locator('.lesson-input')
      .fill(gap)
      .catch(() => {})
    await page
      .locator('.lesson-input')
      .press('Enter')
      .catch(() => {})
    await sleep(500)
  }
  await shot(page, 'guest-desktop', '03-lesson-cloze-verdict')
  await page
    .getByRole('button', { name: /^Дальше/ })
    .click()
    .catch(() => {})
  await sleep(500)
  await shot(page, 'guest-desktop', '04-lesson-warmup-choose')
  // верная опция первого choose (ex-e-0004)
  const choose = exById.get('ex-e-0004')
  if (choose) {
    await page
      .getByRole('button', { name: choose.payload.options[choose.payload.correct], exact: true })
      .click()
      .catch(() => {})
    await sleep(400)
  }
  await page
    .getByRole('button', { name: /^Дальше/ })
    .click()
    .catch(() => {})
  await sleep(500)
  await shot(page, 'guest-desktop', '05-lesson-build-wordbank')
  // сессия SRS после ensureCards
  await go(page, '/srs')
  await shot(page, 'guest-desktop', '06-srs-overview')
  await page
    .getByRole('button', { name: /Начать/ })
    .click()
    .catch(() => {})
  await sleep(700)
  await shot(page, 'guest-desktop', '07-srs-card-front')
  await page.keyboard.press(' ')
  await sleep(400)
  await shot(page, 'guest-desktop', '08-srs-card-back')

  await go(page, '/ranks')
  await shot(page, 'guest-desktop', '09-ranks')
  await go(page, '/gates/E-D')
  await shot(page, 'guest-desktop', '10-gates-intro')
  await go(page, '/quotes')
  await shot(page, 'guest-desktop', '11-quotes-gallery')
  await go(page, '/listen')
  await shot(page, 'guest-desktop', '12-listen')
  await go(page, '/phrasebook')
  await shot(page, 'guest-desktop', '13-phrasebook')
  await go(page, '/phrasebook/vocab')
  await shot(page, 'guest-desktop', '14-phrasebook-vocab')
  await go(page, '/settings')
  await shot(page, 'guest-desktop', '15-settings')
  await go(page, '/login')
  await shot(page, 'guest-desktop', '16-login')
  await go(page, '/nosuchpage')
  await shot(page, 'guest-desktop', '17-404')
  await ctx.close()
}

// 3) GUEST мобайл light
{
  const { ctx, page } = await makeContext('guest-mobile', { mobile: true })
  for (const [hash, name] of [
    ['/', '00-dashboard'],
    ['/path', '01-path'],
    ['/lesson/E-01', '02-lesson-rule'],
    ['/srs', '03-srs'],
    ['/ranks', '04-ranks'],
    ['/quotes', '05-quotes'],
    ['/phrasebook', '06-phrasebook'],
    ['/listen', '07-listen'],
    ['/settings', '08-settings'],
  ]) {
    await go(page, hash)
    await shot(page, 'guest-mobile', name)
  }
  await ctx.close()
}

// 4) DARK: переключение через settings (персист в Dexie)
{
  const { ctx, page } = await makeContext('guest-desktop-dark')
  await go(page, '/settings')
  await page
    .locator('select')
    .first()
    .selectOption('dark')
    .catch(() => {})
  await page
    .waitForFunction(() => document.documentElement.dataset.theme === 'dark', { timeout: 4000 })
    .catch(() => {})
  for (const [hash, name] of [
    ['/', '00-dashboard-dark'],
    ['/lesson/E-01', '01-lesson-rule-dark'],
    ['/srs', '02-srs-dark'],
    ['/ranks', '03-ranks-dark'],
    ['/quotes', '04-quotes-dark'],
    ['/settings', '05-settings-dark'],
  ]) {
    await go(page, hash)
    await shot(page, 'guest-desktop-dark', name)
  }
  await ctx.close()
}

// 5) EN: локаль через settings
{
  const { ctx, page } = await makeContext('guest-desktop-en')
  await go(page, '/settings')
  const selects = page.locator('select')
  await selects
    .nth(1)
    .selectOption('en')
    .catch(async () => {
      // запас: второй select мог оказаться не локалью — ищем по значению
      const n = await selects.count()
      for (let i = 0; i < n; i += 1)
        await selects
          .nth(i)
          .selectOption('en')
          .catch(() => {})
    })
  await sleep(800)
  for (const [hash, name] of [
    ['/', '00-dashboard-en'],
    ['/path', '01-path-en'],
    ['/lesson/E-01', '02-lesson-rule-en'],
    ['/srs', '03-srs-en'],
    ['/ranks', '04-ranks-en'],
    ['/quotes', '05-quotes-en'],
    ['/settings', '06-settings-en'],
  ]) {
    await go(page, hash)
    await shot(page, 'guest-desktop-en', name)
  }
  await ctx.close()
}

// 6) OFFLINE: прогрев (SW + dashboard) → offline → reload
{
  const { ctx, page } = await makeContext('guest-desktop-offline')
  await go(page, '/') // SW устанавливается
  await sleep(1500)
  await ctx.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(1200)
  await shot(page, 'guest-desktop-offline', '00-dashboard-offline')
  await go(page, '/srs')
  await shot(page, 'guest-desktop-offline', '01-srs-offline')
  await ctx.setOffline(false)
  await ctx.close()
}

await browser.close()
console.log('QA-тур завершён; скрины:', OUT)
