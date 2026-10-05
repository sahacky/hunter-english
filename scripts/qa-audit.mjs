// DOM-аудит инвариантов вёрстки (QA §2.11): вместо пиксельного разбора — измеримые проверки.
// Запуск: node scripts/qa-audit.mjs [baseURL] → test-results/qa/audit.json (+ people-readable md)
import { chromium, devices } from '@playwright/test'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'

const BASE = process.argv[2] || 'http://localhost:4173'
const OUT = 'test-results/qa'
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}/console-errors.log`, '')

const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Инварианты, снимаемые в контексте страницы. Возвращает список нарушений. */
const AUDIT_FN = () => {
  const issues = []
  const vw = window.innerWidth
  const doc = document.scrollingElement
  // 1) горизонтальный скролл
  if (doc && doc.scrollWidth > doc.clientWidth + 2)
    issues.push(`HSCROLL: scrollWidth ${doc.scrollWidth} > viewport ${doc.clientWidth}`)
  // 2) вылет за вьюпорт (видимые элементы)
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.right > vw + 4 && cs.position !== 'fixed')
      issues.push(`OVERFLOW-X: <${el.tagName.toLowerCase()} class="${(el.className + '').slice(0, 40)}"> right=${Math.round(r.right)} > vw=${vw}`)
      break
  }
  // 3) зависший лоадер
  if (/Загрузка|Loading/.test(document.body.textContent ?? '') && document.body.textContent.length < 400)
    issues.push('STUCK-LOADING: экран, вероятно, застрял в загрузке')
  // 4) кнопки-крошки на тач-вьюпортах (высота < 36px)
  if (vw < 800) {
    for (const b of document.querySelectorAll('button')) {
      const r = b.getBoundingClientRect()
      if (r.height > 0 && r.height < 30)
        issues.push(`TINY-BUTTON: "${(b.textContent || '').trim().slice(0, 24)}" h=${Math.round(r.height)}`)
    }
  }
  // 5) пустая страница
  const text = (document.body.textContent ?? '').trim()
  if (text.length < 30) issues.push(`EMPTY-PAGE: текста ${text.length} симв.`)
  // 6) перекрытия важных блоков (панели/кнопки в шапке)
  const rects = [...document.querySelectorAll('.panel, header button, .tabbar a')].map((el) => ({
    el,
    r: el.getBoundingClientRect(),
  }))
  for (let i = 0; i < rects.length; i += 1)
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i].r, b = rects[j].r
      if (rects[i].el.contains(rects[j].el) || rects[j].el.contains(rects[i].el)) continue
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (ox > 8 && oy > 8) {
        issues.push(`OVERLAP: ${rects[i].el.tagName}/${rects[j].el.tagName} (${Math.round(ox)}x${Math.round(oy)})`)
        i = rects.length
        break
      }
    }
  return issues
}

async function audit(ctxName, mobile, hash, name) {
  const ctx = await browser.newContext(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 } })
  await ctx.addInitScript(() => localStorage.setItem('hunter-onboarding-done', '1'))
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)))
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message.slice(0, 160)}`))
  await page.goto(`${BASE}/#${hash}`, { waitUntil: 'networkidle' })
  await sleep(700)
  let issues = []
  try {
    issues = await page.evaluate(AUDIT_FN)
  } catch (e) {
    issues = [`AUDIT-FAIL: ${e.message.slice(0, 120)}`]
  }
  await ctx.close()
  return { ctx: ctxName, page: name, hash, issues, errors }
}

const PAGES = [
  ['/', 'dashboard'], ['/path', 'path'], ['/lesson/E-01', 'lesson'],
  ['/lesson/E-05', 'lesson-review'], ['/lesson/B-27', 'lesson-scenes'],
  ['/srs', 'srs'], ['/ranks', 'ranks'], ['/gates/E-D', 'gates'],
  ['/quotes', 'quotes'], ['/listen', 'listen'],
  ['/phrasebook', 'phrasebook'], ['/phrasebook/vocab', 'vocab'],
  ['/settings', 'settings'], ['/login', 'login'], ['/nosuch', '404'],
]

const results = []
for (const [hash, name] of PAGES) results.push(await audit('desktop', false, hash, name))
for (const [hash, name] of PAGES.slice(0, 9)) results.push(await audit('mobile', true, hash, name))

await browser.close()
writeFileSync(`${OUT}/audit.json`, JSON.stringify(results, null, 1))

// markdown-отчёт
const lines = ['# QA DOM-аудит (инварианты вёрстки)', '', '| Контекст | Страница | Находки |', '|---|---|---|']
for (const r of results) {
  const all = [...r.issues.map((i) => `\`${i}\``), ...r.errors.map((e) => `console: \`${e}\``)]
  lines.push(`| ${r.ctx} | ${r.page} (${r.hash}) | ${all.length ? all.join('<br>') : '✅'} |`)
}
writeFileSync(`${OUT}/AUDIT.md`, lines.join('\n') + '\n')
const bad = results.filter((r) => r.issues.length + r.errors.length > 0).length
console.log(`аудит: ${results.length} проверок, с находками: ${bad}; отчёты: ${OUT}/audit.json, AUDIT.md`)
