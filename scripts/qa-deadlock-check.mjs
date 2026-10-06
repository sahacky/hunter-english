// Живой (прод-сборка) прогон сценария бага 2026-10-06: плохой пользователь
// (неверные ответы, споры, провал разогрева → «Повторить шаг») завершает E-01.
// Запуск: node scripts/qa-deadlock-check.mjs [baseURL]
/* global document */
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const BASE = process.argv[2] || 'http://localhost:4173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const exercises = JSON.parse(readFileSync('data/lessons/exercises-e.json', 'utf8')).items
const phrases = Object.fromEntries(
  JSON.parse(readFileSync('data/phrases/phrases-e.json', 'utf8')).items.map((p) => [p.id, p]),
)
const exById = new Map(exercises.map((e) => [e.id, e]))

const browser = await chromium.launch({
  args: [
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
  ],
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 120)))

await page.goto(`${BASE}/#/lesson/E-01`, { waitUntil: 'networkidle' })
await sleep(900)
await page.getByRole('button', { name: /Понятно/ }).click()
await sleep(400)

let smart = false
const badPairs = new Set()
const log = []
let last = ''

for (let tick = 0; tick < 700; tick += 1) {
  if (await page.getByText('Урок завершён').count()) break
  if (await page.getByText('В колоду').count()) {
    await page.getByRole('button', { name: /Завершить урок/ }).click()
    await sleep(900)
    continue
  }
  const id = await page.evaluate(() =>
    document.querySelector('[data-exercise-id]')?.getAttribute('data-exercise-id'),
  )
  const ex = id ? exById.get(id) : undefined
  const phrase = ex ? phrases[ex.payload?.phrase_id] : undefined

  // спор прежде всего; голосовые — текстовым вводом (fake-микрофон зависает)
  if (await click(/Я был прав/)) continue
  if (await click(/Сказал своими словами|Сказал\(-а\)/)) continue
  const typingOpen = (await page.locator('.lesson-input:not([disabled])').count()) > 0
  if (!typingOpen && (await click(/Ввести текстом/))) continue

  const input = page.locator('.lesson-input:not([disabled])')
  if (ex?.type === 'word_bank' && (await input.count())) {
    await input.fill(smart ? (phrase?.text_en ?? 'zzz') : 'zzz wrong')
    await input.press('Enter')
    await sleep(350)
    continue
  }
  if (await input.count()) {
    const gap = ex?.payload?.gap_answers
    const good = ['translate', 'dictation', 'find_error', 'speak', 'shadowing', 'retell'].includes(
      ex?.type,
    )
      ? (phrase?.text_en ?? '')
      : (gap?.[0] ?? '')
    await input.fill(smart ? good || 'zzz' : 'zzz')
    await input.press('Enter')
    await sleep(350)
    continue
  }
  if (ex?.type === 'word_bank') {
    const tile = page.locator('button.lesson-tile:not(.lesson-tile-slot):not([disabled])').first()
    if (await tile.count()) {
      await tile.click()
      await sleep(150)
      continue
    }
    if (await click(/^Проверить/)) {
      await sleep(350)
      continue
    }
  }
  if (ex?.type === 'choose_translation') {
    const opts = ex.payload.options
    const name = smart ? opts[ex.payload.correct] : null
    const btn = name
      ? page.getByRole('button', { name, exact: true }).first()
      : page.locator('button.lesson-option:not([disabled])').first()
    if ((await btn.count()) && !(await btn.isDisabled())) {
      await btn.click()
      await sleep(300)
      continue
    }
    // уже отвечена — дальше
  }
  if (ex?.type === 'match_pairs') {
    const pairs = ex.payload.pairs
    const free = async (n) => {
      const btns = page.getByRole('button', { name: n, exact: true })
      const cnt = await btns.count()
      for (let i = 0; i < cnt; i += 1) if (!(await btns.nth(i).isDisabled())) return true
      return false
    }
    if (!badPairs.has(id) && !smart && (await free(pairs[0].en)) && (await free(pairs[1].ru))) {
      badPairs.add(id)
      await page.getByRole('button', { name: pairs[0].en, exact: true }).first().click()
      await page.getByRole('button', { name: pairs[1].ru, exact: true }).first().click()
      await sleep(250)
      continue
    }
    let pair = null
    for (const p of pairs) {
      if ((await free(p.en)) && (await free(p.ru))) {
        pair = p
        break
      }
    }
    if (pair) {
      await page.getByRole('button', { name: pair.en, exact: true }).first().click()
      await page.getByRole('button', { name: pair.ru, exact: true }).first().click()
      await sleep(250)
      continue
    }
  }
  if (await click(/Повторить шаг/)) {
    smart = true
    await sleep(400)
    continue
  }
  if (await click(/^Дальше/)) {
    await sleep(300)
    continue
  }
  if (await click(/Ещё попытка/)) {
    await sleep(250)
    continue
  }
  await sleep(150)

  const snap = await page.evaluate(() => document.body.textContent?.slice(0, 180))
  if (snap === last) {
    log.push(`stuck@${tick}`)
    if (log.filter((x) => x.startsWith(`stuck@`)).length > 20) {
      console.error(
        `ЗАСТРЯЛИ на тике ${tick}: ${await page.evaluate(() => document.body.textContent?.slice(0, 400))}`,
      )
      process.exit(1)
    }
  } else log.length = 0
  last = snap ?? ''
}

async function click(re) {
  const btn = page.getByRole('button', { name: re }).first()
  if (!(await btn.count())) return false
  if (await btn.isDisabled()) return false
  await btn.click()
  await sleep(200)
  return true
}

const finalText = await page.evaluate(() => document.body.textContent?.slice(0, 300))
console.log('финальный экран:', finalText?.replace(/\n+/g, ' | ').slice(0, 220))
const done = await page.getByText('Урок завершён').count()
console.log('урок завершён:', done > 0)
console.log('pageerror/console errors:', errors.length, errors.slice(0, 3))
await browser.close()
process.exit(done > 0 && errors.length === 0 ? 0 : 1)
